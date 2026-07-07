const crypto = require('crypto');

function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;

  let phone = digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`;
  const numeric = phone.slice(1);
  if (numeric.length < 9 || numeric.length > 15) return null;
  return phone;
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function otpMessage(code) {
  const ttl = process.env.OTP_TTL_MINUTES || '5';
  return `Your Spark Dating verification code is ${code}. It expires in ${ttl} minutes.`;
}

function isProviderConfigured(provider) {
  if (provider === 'bird') {
    const workspaceId = process.env.BIRD_WORKSPACE_ID;
    const apiKey = process.env.BIRD_API_KEY;
    const routeId = process.env.BIRD_NAVIGATOR_ID || process.env.BIRD_CHANNEL_ID;
    return !!(workspaceId && apiKey && routeId);
  }
  if (provider === 'twilio') {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }
  if (provider === 'africas_talking') {
    return !!(process.env.AFRICAS_TALKING_USERNAME && process.env.AFRICAS_TALKING_API_KEY);
  }
  return false;
}

function birdApiBase(apiKey) {
  if (process.env.BIRD_API_BASE) {
    return process.env.BIRD_API_BASE.replace(/\/$/, '');
  }
  if (apiKey?.startsWith('bk_eu1_')) return 'https://eu1.platform.bird.com/v1';
  if (apiKey?.startsWith('bk_us1_')) return 'https://us1.platform.bird.com/v1';
  return 'https://api.bird.com';
}

async function sendBirdSms(phone, code) {
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
          text: { text: otpMessage(code) },
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Bird SMS failed:', details);
    throw new Error('Failed to deliver verification code');
  }
}

async function sendTwilioSms(phone, code) {
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
        Body: otpMessage(code),
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Twilio SMS failed:', details);
    throw new Error('Failed to deliver verification code');
  }
}

async function sendAfricasTalkingSms(phone, code) {
  const username = process.env.AFRICAS_TALKING_USERNAME;
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
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
      message: otpMessage(code),
      from: senderId,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Africa's Talking SMS failed:", details);
    throw new Error('Failed to deliver verification code');
  }

  const payload = await response.json();
  const entry = payload?.SMSMessageData?.Recipients?.[0];
  if (entry?.status && entry.status !== 'Success') {
    console.error("Africa's Talking delivery status:", entry);
    throw new Error(entry.statusText || 'Failed to deliver verification code');
  }
}

async function sendOtpSms(phone, code) {
  const provider = process.env.SMS_PROVIDER || 'bird';

  if (provider === 'console' || !isProviderConfigured(provider)) {
    if (provider !== 'console') {
      console.warn(
        `[OTP] SMS provider "${provider}" is not fully configured. Using console fallback.`,
      );
    }
    console.log(`[OTP] ${phone} -> ${code}`);
    return { delivered: false, channel: provider === 'console' ? 'console' : 'fallback' };
  }

  if (provider === 'bird') {
    await sendBirdSms(phone, code);
    return { delivered: true, channel: 'bird' };
  }

  if (provider === 'twilio') {
    await sendTwilioSms(phone, code);
    return { delivered: true, channel: 'twilio' };
  }

  if (provider === 'africas_talking') {
    await sendAfricasTalkingSms(phone, code);
    return { delivered: true, channel: 'africas_talking' };
  }

  console.log(`[OTP] ${phone} -> ${code}`);
  return { delivered: false, channel: 'unknown' };
}

module.exports = {
  normalizePhone,
  generateOtpCode,
  sendOtpSms,
  isProviderConfigured,
};
