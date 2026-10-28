const { normalizePhone } = require('./otp');
const { APP_DISPLAY_NAME } = require('../constants');

let accessToken = null;
let tokenExpiry = 0;

function consumerKey() {
  return process.env.PESAPAL_CONSUMER_KEY;
}

function consumerSecret() {
  return process.env.PESAPAL_CONSUMER_SECRET;
}

function apiBase() {
  if (process.env.PESAPAL_API_BASE) {
    return process.env.PESAPAL_API_BASE.replace(/\/$/, '');
  }
  return process.env.PESAPAL_SANDBOX === 'false'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';
}

function isPesapalConfigured() {
  return !!(consumerKey() && consumerSecret());
}

function callbackUrl() {
  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return process.env.PESAPAL_CALLBACK_URL || `${base}/api/subscriptions/pesapal/callback`;
}

function ipnUrl() {
  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return process.env.PESAPAL_IPN_URL || `${base}/api/subscriptions/pesapal/ipn`;
}

/** PesaPal often returns error: { message: null, code: null } on successful responses. */
function pesapalErrorDetails(payload) {
  const err = payload?.error;
  if (!err || typeof err !== 'object') {
    return { message: '', code: '', pending: false, hasError: false };
  }
  const message = typeof err.message === 'string' ? err.message.trim() : '';
  const code = typeof err.code === 'string' ? err.code.trim() : err.code ? String(err.code) : '';
  const pending = message === 'Pending Payment' || code === 'payment_details_not_found';
  return {
    message,
    code,
    pending,
    hasError: !!(message || code),
  };
}

async function pesapalRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (auth) {
    const token = await ensureToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  const { hasError, pending, message: errorMessage } = pesapalErrorDetails(payload);
  if ((hasError && !pending) || (!response.ok && !pending)) {
    const message =
      errorMessage ||
      payload?.message ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload));
    console.error('PesaPal API error:', message, payload);
    throw new Error(message?.trim() || 'PesaPal request failed');
  }

  return payload;
}

/**
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication
 */
async function requestToken() {
  const payload = await pesapalRequest('/api/Auth/RequestToken', {
    method: 'POST',
    body: {
      consumer_key: consumerKey(),
      consumer_secret: consumerSecret(),
    },
  });

  if (!payload.token) {
    throw new Error('PesaPal did not return an access token');
  }

  accessToken = payload.token;
  tokenExpiry = payload.expiryDate ? Date.parse(payload.expiryDate) : Date.now() + 4 * 60 * 1000;
  return accessToken;
}

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 30_000) {
    return accessToken;
  }
  return requestToken();
}

/**
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl
 */
async function registerIpnUrl(url = ipnUrl()) {
  const payload = await pesapalRequest('/api/URLSetup/RegisterIPN', {
    method: 'POST',
    auth: true,
    body: {
      url,
      ipn_notification_type: 'GET',
    },
  });
  return payload;
}

async function ensureIpnId() {
  if (process.env.PESAPAL_IPN_ID) {
    return process.env.PESAPAL_IPN_ID;
  }
  const registered = await registerIpnUrl();
  const ipnId = registered.ipn_id || registered.ipnId;
  if (!ipnId) {
    throw new Error(
      'PesaPal IPN is not registered. Run: npm run pesapal:register-ipn and set PESAPAL_IPN_ID in .env',
    );
  }
  console.warn('[PesaPal] Registered IPN. Add to backend/.env:', `PESAPAL_IPN_ID=${ipnId}`);
  return ipnId;
}

function buildMerchantReference(plan, metadata = {}) {
  const userPart = String(metadata.userId || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `spark-${plan}-${userPart}-${Date.now()}`.slice(0, 50);
}

function phoneForPesapal(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Enter a valid phone number');
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits.startsWith('256')) {
    return digits.slice(3);
  }
  if (digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest
 */
async function initiatePesapalPayment(phone, plan, amountUgx, metadata = {}) {
  const notificationId = await ensureIpnId();
  const merchantReference = buildMerchantReference(plan, metadata);
  const email =
    metadata.customerEmail ||
    `user-${String(metadata.userId || 'guest').slice(0, 8)}@spark-dating.local`;

  const payload = await pesapalRequest('/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    auth: true,
    body: {
      id: merchantReference,
      currency: process.env.PESAPAL_CURRENCY || 'UGX',
      amount: Number(amountUgx),
      description: `${APP_DISPLAY_NAME} ${plan} chat access`.slice(0, 100),
      callback_url: callbackUrl(),
      notification_id: notificationId,
      billing_address: {
        email_address: email,
        phone_number: phoneForPesapal(phone),
        country_code: process.env.PESAPAL_COUNTRY_CODE || 'UG',
      },
    },
  });

  const orderTrackingId = payload.order_tracking_id;
  const redirectUrl = payload.redirect_url;
  if (!orderTrackingId || !redirectUrl) {
    console.error('PesaPal SubmitOrderRequest missing fields:', payload);
    throw new Error('Could not start PesaPal payment. Try again in a moment.');
  }

  return {
    orderTrackingId,
    merchantReference,
    redirectUrl,
    status: payload.status || '200',
  };
}

/**
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus
 */
async function verifyPesapalPayment(orderTrackingId) {
  if (!orderTrackingId) {
    throw new Error('orderTrackingId is required');
  }

  const token = await ensureToken();
  const response = await fetch(
    `${apiBase()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = await response.json().catch(() => ({}));
  const { hasError, pending, message: errorMessage } = pesapalErrorDetails(payload);

  if ((hasError && !pending) || (!response.ok && !pending)) {
    const message =
      errorMessage ||
      payload?.message ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload));
    console.error('PesaPal API error:', message, payload);
    throw new Error(message?.trim() || 'PesaPal request failed');
  }

  const statusCode = Number(payload.status_code);
  const statusDescription = payload.payment_status_description
    || (pending ? 'PENDING' : 'UNKNOWN');
  const approved = statusCode === 1 || statusDescription === 'COMPLETED';

  return {
    approved,
    status: statusDescription,
    statusCode,
    paymentMethod: payload.payment_method || null,
    payload,
  };
}

module.exports = {
  isPesapalConfigured,
  requestToken,
  registerIpnUrl,
  initiatePesapalPayment,
  verifyPesapalPayment,
  apiBase,
};
