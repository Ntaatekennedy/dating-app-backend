const { normalizePhone, resolveAfricaTalkingApiKey } = require('./otp');
const { APP_DISPLAY_NAME } = require('../constants');
const { isMtnMomoConfigured, initiateMtnPayment } = require('./mtnMomo');
const { isFlutterwaveConfigured, initiateFlutterwaveMobileMoneyCharge } = require('./flutterwave');
const { isPesapalConfigured, initiatePesapalPayment } = require('./pesapal');
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
    `${APP_DISPLAY_NAME}: Approve ${formatted} for ${label} chat access. ` +
    'Check your phone for the mobile money payment popup and enter your PIN.'
  );
}

function paymentsBaseUrl() {
  if (process.env.AFRICAS_TALKING_PAYMENTS_SANDBOX === 'true') {
    return 'https://payments.sandbox.africastalking.com';
  }
  return 'https://payments.africastalking.com';
}

function isMobileCheckoutConfigured() {
  return !!(
    process.env.AFRICAS_TALKING_USERNAME &&
    resolveAfricaTalkingApiKey() &&
    process.env.AFRICAS_TALKING_PAYMENT_PRODUCT_NAME
  );
}

function preferredMobileMoneyProvider() {
  return (process.env.MOBILE_MONEY_PROVIDER || '').trim().toLowerCase();
}

function resolveMobileMoneyProvider() {
  const forced = preferredMobileMoneyProvider();
  if (forced === 'mtn' && isMtnMomoConfigured()) return 'mtn';
  if (forced === 'pesapal' && isPesapalConfigured()) return 'pesapal';
  if (forced === 'flutterwave' && isFlutterwaveConfigured()) return 'flutterwave';
  if (forced === 'africas_talking' && isMobileCheckoutConfigured()) return 'africas_talking';

  if (isPesapalConfigured()) return 'pesapal';
  if (isFlutterwaveConfigured()) return 'flutterwave';
  if (isMtnMomoConfigured()) return 'mtn';
  if (isMobileCheckoutConfigured()) return 'africas_talking';
  return null;
}
async function initiateAfricasTalkingMobileCheckout(phone, plan, amountUgx, metadata = {}) {
  const username = process.env.AFRICAS_TALKING_USERNAME;
  const apiKey = resolveAfricaTalkingApiKey();
  const productName = process.env.AFRICAS_TALKING_PAYMENT_PRODUCT_NAME;

  const body = {
    username,
    productName,
    phoneNumber: phone,
    currencyCode: process.env.AFRICAS_TALKING_CURRENCY_CODE || 'UGX',
    amount: amountUgx,
    metadata: {
      plan,
      ...metadata,
    },
  };

  const providerChannel = process.env.AFRICAS_TALKING_PROVIDER_CHANNEL;
  if (providerChannel) body.providerChannel = providerChannel;

  const response = await fetch(`${paymentsBaseUrl()}/mobile/checkout/request`, {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.errorMessage ||
      payload?.description ||
      payload?.message ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload));
    console.error("Africa's Talking mobile checkout failed:", message);
    throw new Error(
      message?.trim() ||
        "Could not start mobile money checkout. Check Africa's Talking payment product settings.",
    );
  }

  const transactionId = payload.transactionId || payload.details?.transactionId || null;
  if (!transactionId) {
    console.error("Africa's Talking mobile checkout missing transactionId:", payload);
    throw new Error('Mobile money checkout did not start. Try again in a moment.');
  }

  return { transactionId, status: payload.status || 'Pending', payload };
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

function isAnyMobileMoneyProviderConfigured() {
  return (
    isPesapalConfigured() ||
    isFlutterwaveConfigured() ||
    isMtnMomoConfigured() ||
    isMobileCheckoutConfigured()
  );
}

async function sendPaymentPromptSms(phone, plan, metadata = {}) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Enter a valid phone number');
  }

  const amountUgx = planPriceUgx(plan);
  if (!amountUgx) {
    throw new Error('Invalid plan');
  }

  const simulateRequested = process.env.MOBILE_MONEY_SIMULATE === 'true';
  const providerReady = isAnyMobileMoneyProviderConfigured();

  if (simulateRequested && !providerReady) {
    console.log(
      `[MobileMoney SIMULATE] ${normalized} plan=${plan} amount=${amountUgx} UGX — no real popup`,
    );
    return {
      delivered: true,
      channel: 'simulate',
      phone: normalized,
      transactionId: `SIM-${Date.now()}`,
      simulated: true,
    };
  }

  if (!providerReady) {
    throw new Error(
      'Mobile money is not configured. Add PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET to backend/.env ' +
        '(see PESAPAL_SETUP.md), or Flutterwave / MTN MoMo credentials.',
    );
  }

  const provider = resolveMobileMoneyProvider();
  if (!provider) {
    throw new Error('Mobile money checkout failed to start. Check your payment provider credentials.');
  }

  if (provider === 'pesapal') {
    const pesapal = await initiatePesapalPayment(normalized, plan, amountUgx, metadata);
    return {
      delivered: true,
      channel: 'pesapal',
      phone: normalized,
      transactionId: pesapal.orderTrackingId,
      merchantReference: pesapal.merchantReference,
      redirectUrl: pesapal.redirectUrl,
      checkoutStatus: pesapal.status,
      paymentInstruction:
        'Open the PesaPal payment page, choose Mobile Money (MTN/Airtel), and complete payment on your phone.',
    };
  }

  if (provider === 'flutterwave') {
    const fw = await initiateFlutterwaveMobileMoneyCharge(normalized, plan, amountUgx, metadata);
    return {
      delivered: true,
      channel: 'flutterwave',
      phone: normalized,
      transactionId: fw.chargeId,
      chargeReference: fw.reference,
      checkoutStatus: fw.status,
      paymentInstruction: fw.instruction,
      network: fw.network,
    };
  }

  if (provider === 'mtn') {
    const momo = await initiateMtnPayment(normalized, plan, amountUgx, metadata);
    return {
      delivered: true,
      channel: momo.mode === 'preapproval' ? 'mtn_momo_preapproval' : 'mtn_momo',
      phone: normalized,
      transactionId: momo.referenceId,
      externalId: momo.externalId,
      checkoutStatus: momo.status,
      preApproval: momo.preApproval || null,
      paymentInstruction:
        'MTN Mobile Money popup sent to this phone. Enter your PIN to approve the payment.',
      network: 'MTN',
    };
  }

  if (provider === 'africas_talking') {
    const checkout = await initiateAfricasTalkingMobileCheckout(
      normalized,
      plan,
      amountUgx,
      metadata,
    );
    return {
      delivered: true,
      channel: 'africas_talking_checkout',
      phone: normalized,
      transactionId: checkout.transactionId,
      checkoutStatus: checkout.status,
    };
  }

  throw new Error(
    'Mobile money checkout failed to start. Check your payment provider credentials.',
  );
}

module.exports = {
  planPriceUgx,
  planLabel,
  paymentPromptMessage,
  isMobileCheckoutConfigured,
  isAnyMobileMoneyProviderConfigured,
  sendPaymentPromptSms,
};
