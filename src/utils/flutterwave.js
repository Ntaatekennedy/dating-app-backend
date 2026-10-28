const crypto = require('crypto');
const { normalizePhone } = require('./otp');

const TOKEN_URL =
  process.env.FLUTTERWAVE_TOKEN_URL ||
  'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

let accessToken = null;
let expiresIn = 0;
let lastTokenRefreshTime = 0;
let refreshPromise = null;

function clientId() {
  return process.env.FLUTTERWAVE_CLIENT_ID || process.env.FLW_CLIENT_ID;
}

function clientSecret() {
  return process.env.FLUTTERWAVE_CLIENT_SECRET || process.env.FLW_CLIENT_SECRET;
}

function legacySecretKey() {
  return process.env.FLUTTERWAVE_SECRET_KEY;
}

function usesOAuth() {
  return !!(clientId() && clientSecret());
}

function apiBase() {
  if (process.env.FLUTTERWAVE_API_BASE) {
    return process.env.FLUTTERWAVE_API_BASE.replace(/\/$/, '');
  }
  return process.env.FLUTTERWAVE_SANDBOX === 'true'
    ? 'https://developersandbox-api.flutterwave.com'
    : 'https://api.flutterwave.com';
}

function isFlutterwaveConfigured() {
  return usesOAuth() || !!legacySecretKey();
}

function traceHeaders(reference) {
  const seed = String(reference || crypto.randomUUID()).replace(/[^a-zA-Z0-9-]/g, '');
  const traceId = `spark-${seed || Date.now()}`.slice(0, 255);
  const idempotencyKey = `idem-${seed || Date.now()}`.slice(0, 255);
  return {
    'X-Trace-Id': traceId.length >= 12 ? traceId : `spark-${Date.now()}`,
    'X-Idempotency-Key': idempotencyKey.length >= 12 ? idempotencyKey : `idem-${Date.now()}`,
  };
}

async function refreshToken() {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    throw new Error('FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET are required');
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: 'client_credentials',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const message =
      payload?.error_description ||
      payload?.error ||
      payload?.message ||
      'Could not authenticate with Flutterwave';
    console.error('Flutterwave token refresh failed:', message, payload);
    throw new Error(String(message));
  }

  accessToken = payload.access_token;
  expiresIn = Number(payload.expires_in) || 600;
  lastTokenRefreshTime = Date.now();
  return accessToken;
}

async function ensureTokenIsValid() {
  if (!usesOAuth()) {
    return legacySecretKey();
  }

  const currentTime = Date.now();
  const timeSinceLastRefresh = (currentTime - lastTokenRefreshTime) / 1000;
  const timeLeft = expiresIn - timeSinceLastRefresh;

  if (!accessToken || timeLeft < 60) {
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }

  return accessToken;
}

async function getAuthorizationBearer() {
  if (usesOAuth()) {
    return ensureTokenIsValid();
  }
  const key = legacySecretKey();
  if (!key) {
    throw new Error(
      'Flutterwave is not configured. Set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET.',
    );
  }
  return key;
}

function parseUgandaMobileMoney(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Enter a valid phone number');
  }

  const digits = normalized.replace(/\D/g, '');
  let national = digits;
  if (digits.startsWith('256')) {
    national = digits.slice(3);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  }

  if (national.length !== 9 || !national.startsWith('7')) {
    throw new Error('Enter a valid Uganda mobile money number (+256...)');
  }

  const prefix = national.slice(0, 2);
  const mtnPrefixes = ['77', '78', '76', '39', '79'];
  const airtelPrefixes = ['70', '75', '74'];
  let network = (process.env.FLUTTERWAVE_DEFAULT_NETWORK || 'MTN').toUpperCase();

  if (mtnPrefixes.includes(prefix)) {
    network = 'MTN';
  } else if (airtelPrefixes.includes(prefix)) {
    network = 'AIRTEL';
  }

  return {
    country_code: '256',
    phone_number: national,
    network,
  };
}

function buildReference(plan, metadata = {}) {
  const userPart = String(metadata.userId || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const ref = `spark-${plan}-${userPart}-${Date.now()}`;
  return ref.slice(0, 42);
}

async function flutterwaveRequest(path, { method = 'GET', body, reference } = {}) {
  const bearer = await getAuthorizationBearer();
  const headers = {
    Authorization: `Bearer ${bearer}`,
    Accept: 'application/json',
    ...traceHeaders(reference),
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload));
    console.error('Flutterwave API error:', message, payload);
    const err = new Error(
      message?.trim() ||
        'Could not complete Flutterwave request. Check Flutterwave credentials.',
    );
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

/**
 * List customers — GET /customers
 * Docs: https://developer.flutterwave.com/reference/customers_list
 */
async function listFlutterwaveCustomers(page = 1, size = 10) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(50, Math.max(10, Number(size) || 10));
  return flutterwaveRequest(`/customers?page=${safePage}&size=${safeSize}`);
}

/**
 * Create customer — POST /customers
 * Docs: https://developer.flutterwave.com/docs/mobile-money
 */
async function createFlutterwaveCustomer({ email, mobileMoney, metadata = {} }) {
  const body = {
    email,
    phone: {
      country_code: mobileMoney.country_code,
      number: mobileMoney.phone_number,
    },
  };

  const displayName = metadata.displayName || metadata.customerName;
  if (displayName && typeof displayName === 'string') {
    const parts = displayName.trim().split(/\s+/);
    body.name = {
      first: parts[0] || 'Spark',
      last: parts.length > 1 ? parts.slice(1).join(' ') : 'User',
    };
  }

  const payload = await flutterwaveRequest('/customers', {
    method: 'POST',
    body,
    reference: email,
  });
  return payload.data;
}

async function findFlutterwaveCustomerByEmail(email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const payload = await listFlutterwaveCustomers(page, 50);
    const rows = payload.data || [];
    const found = rows.find((row) => row.email?.trim().toLowerCase() === target);
    if (found) return found;
    if (rows.length < 50) break;
  }
  return null;
}

async function ensureFlutterwaveCustomer({ email, mobileMoney, metadata = {} }) {
  try {
    const created = await createFlutterwaveCustomer({ email, mobileMoney, metadata });
    if (created?.id) return created;
  } catch (err) {
    if (err.status !== 409 && err.status !== 400) {
      const existing = await findFlutterwaveCustomerByEmail(email);
      if (existing) return existing;
      throw err;
    }
    const existing = await findFlutterwaveCustomerByEmail(email);
    if (existing) return existing;
    throw err;
  }

  const existing = await findFlutterwaveCustomerByEmail(email);
  if (existing) return existing;
  throw new Error('Could not create or find Flutterwave customer');
}

async function createFlutterwaveMobileMoneyPaymentMethod(mobileMoney, reference) {
  const payload = await flutterwaveRequest('/payment-methods', {
    method: 'POST',
    body: {
      type: 'mobile_money',
      mobile_money: {
        country_code: mobileMoney.country_code,
        network: mobileMoney.network,
        phone_number: mobileMoney.phone_number,
      },
    },
    reference,
  });
  const paymentMethodId = payload.data?.id;
  if (!paymentMethodId) {
    console.error('Flutterwave payment method missing id:', payload);
    throw new Error('Could not create mobile money payment method');
  }
  return paymentMethodId;
}

/**
 * Collect mobile money: customer → payment method → charge.
 * Docs: https://developer.flutterwave.com/docs/mobile-money
 */
async function initiateFlutterwaveMobileMoneyCharge(phone, plan, amountUgx, metadata = {}) {
  const mobileMoney = parseUgandaMobileMoney(phone);
  const reference = buildReference(plan, metadata);
  const email =
    metadata.customerEmail ||
    `user-${String(metadata.userId || 'guest').slice(0, 8)}@spark-dating.local`;

  const customer = await ensureFlutterwaveCustomer({ email, mobileMoney, metadata });
  const paymentMethodId = await createFlutterwaveMobileMoneyPaymentMethod(mobileMoney, reference);

  const payload = await flutterwaveRequest('/charges', {
    method: 'POST',
    body: {
      currency: process.env.FLUTTERWAVE_CURRENCY || 'UGX',
      customer_id: customer.id,
      payment_method_id: paymentMethodId,
      amount: amountUgx,
      reference,
      meta: {
        plan,
        userId: metadata.userId || null,
      },
    },
    reference,
  });

  const charge = payload.data || {};
  const chargeId = charge.id;
  if (!chargeId) {
    console.error('Flutterwave charge missing id:', payload);
    throw new Error('Mobile money checkout did not start. Try again in a moment.');
  }

  const instruction =
    charge.next_action?.payment_instruction?.note ||
    `Authorize this payment on ${mobileMoney.network} mobile money (${phone}).`;

  return {
    chargeId,
    reference: charge.reference || reference,
    status: charge.status || 'pending',
    instruction,
    network: mobileMoney.network,
    customerId: customer.id,
  };
}

async function verifyFlutterwaveCharge(chargeId) {
  if (!chargeId) {
    throw new Error('chargeId is required');
  }

  const payload = await flutterwaveRequest(`/charges/${encodeURIComponent(chargeId)}`, {
    reference: chargeId,
  });
  const charge = payload.data || {};
  const status = String(charge.status || '').toLowerCase();

  return {
    approved: status === 'succeeded',
    status: charge.status || 'unknown',
    charge,
  };
}

module.exports = {
  isFlutterwaveConfigured,
  parseUgandaMobileMoney,
  listFlutterwaveCustomers,
  createFlutterwaveCustomer,
  ensureFlutterwaveCustomer,
  initiateFlutterwaveMobileMoneyCharge,
  verifyFlutterwaveCharge,
  ensureTokenIsValid,
  flutterwaveRequest,
  apiBase,
};
