const { normalizePhone, isProviderConfigured, resolveSmsProvider } = require('./otp');

function planPriceUgx(plan) {
  switch (plan) {
    case 'daily':
      return 1200;
    case 'weekly':
      return 3500;
    case 'monthly':
      return 12000;
    default:
      return 0;
  }
}

function planLabel(plan) {
  switch (plan) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return 'Premium';
  }
}

function paymentPromptMessage(plan, amountUgx) {
  const label = planLabel(plan);
  const formatted = `UGX ${Number(amountUgx).toLocaleString('en-UG')}`;
  return (
    `Spark Dating: Approve ${formatted} for ${label} chat access. ` +
    'A mobile money popup will appear on this phone — enter your PIN to pay.'
  );
}

function isJwtApiKey(key) {
  return typeof key === 'string' && key.startsWith('eyJ') && key.includes('.');
}

function resolveAfricaTalkingApiKey() {
  if (process.env.AFRICAS_TALKING_API_KEY) return process.env.AFRICAS_TALKING_API_KEY;
  const birdKey = process.env.BIRD_API_KEY || '';
  if (isJwtApiKey(birdKey)) return birdKey;
  return null;
}

function birdApiBase(apiKey) {
  if (process.env.BIRD_API_BASE) {
    return process.env.BIRD_API_BASE.replace(/\/$/, '');
  }
  if (apiKey?.startsWith('bk_eu1_')) return 'https://eu1.platform.bird.com/v1';
  if (apiKey?.startsWith('bk_us1_')) return 'https://us1.platform.bird.com/v1';
  return 'https://api.bird.com';
}

async function sendBirdSmsText(phone, text) {
  const workspaceId = process.env.BIRD_WORKSPACE_ID;
  const apiKey = process.env.BIRD_API_KEY;
  const navigatorId = process.env.BIRD_NAVIGATOR_ID;
  const channelId = process.env.BIRD_CHANNEL_ID;
  const apiBase = birdApiBase(apiKey);
  const routeType = navigatorId ? 'navigators' : 'channels';
  const routeId = navigatorId || channelId;

  const response = await fetch(
    `${apiBase}/workspaces/${workspaceId}/${routeType}/${routeId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        receiver: {
          contacts: [{ identifierValue: phone }],
        },
        body: {
          type: 'text',
          text: { text },
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Bird payment SMS failed:', details);
    throw new Error('Failed to send mobile money prompt');
  }
}

async function sendTwilioSmsText(phone, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: from,
        Body: text,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Twilio payment SMS failed:', details);
    throw new Error('Failed to send mobile money prompt');
  }
}

async function sendAfricasTalkingSmsText(phone, text) {
  const username = process.env.AFRICAS_TALKING_USERNAME;
  const apiKey = resolveAfricaTalkingApiKey();
  const senderId = process.env.AFRICAS_TALKING_SENDER_ID || 'Spark';

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username,
      to: phone,
      message: text,
      from: senderId,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Africa's Talking payment SMS failed:", details);
    throw new Error('Failed to send mobile money prompt');
  }
}

async function sendPaymentPromptSms(phone, plan) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Enter a valid phone number');
  }

  const amountUgx = planPriceUgx(plan);
  if (!amountUgx) {
    throw new Error('Invalid plan');
  }

  const message = paymentPromptMessage(plan, amountUgx);
  const provider = resolveSmsProvider();

  if (provider === 'console' || !isProviderConfigured(provider)) {
    if (provider !== 'console') {
      console.warn(
        `[MobileMoney] SMS provider "${provider}" is not fully configured. Using console fallback.`,
      );
    }
    console.log(`[MobileMoney] ${normalized} -> ${message}`);
    return { delivered: false, channel: provider === 'console' ? 'console' : 'fallback', phone: normalized };
  }

  if (provider === 'bird') {
    await sendBirdSmsText(normalized, message);
    return { delivered: true, channel: 'bird', phone: normalized };
  }

  if (provider === 'twilio') {
    await sendTwilioSmsText(normalized, message);
    return { delivered: true, channel: 'twilio', phone: normalized };
  }

  if (provider === 'africas_talking') {
    await sendAfricasTalkingSmsText(normalized, message);
    return { delivered: true, channel: 'africas_talking', phone: normalized };
  }

  console.log(`[MobileMoney] ${normalized} -> ${message}`);
  return { delivered: false, channel: 'unknown', phone: normalized };
}

module.exports = {
  planPriceUgx,
  planLabel,
  paymentPromptMessage,
  sendPaymentPromptSms,
};
