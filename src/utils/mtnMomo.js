const crypto = require('crypto');
const { APP_DISPLAY_NAME } = require('../constants');
const { planDurationDays } = require('./helpers');

function isMtnMomoConfigured() {
  return !!(
    process.env.MTN_MOMO_SUBSCRIPTION_KEY &&
    process.env.MTN_MOMO_API_USER &&
    process.env.MTN_MOMO_API_KEY
  );
}

function useMtnPreApproval() {
  return process.env.MTN_MOMO_USE_PREAPPROVAL !== 'false';
}

function mtnMomoBaseUrl() {
  if (process.env.MTN_MOMO_BASE_URL) {
    return process.env.MTN_MOMO_BASE_URL.replace(/\/$/, '');
  }
  if (process.env.MTN_MOMO_ENV === 'production') {
    return 'https://ericssonbasicapi1.azure-api.net';
  }
  return 'https://sandbox.momodeveloper.mtn.com';
}

function mtnTargetEnv() {
  if (process.env.MTN_MOMO_TARGET_ENV) return process.env.MTN_MOMO_TARGET_ENV;
  return process.env.MTN_MOMO_ENV === 'production' ? 'mtnuganda' : 'sandbox';
}

function mtnCurrency() {
  if (process.env.MTN_MOMO_CURRENCY) return process.env.MTN_MOMO_CURRENCY;
  return process.env.MTN_MOMO_ENV === 'production' ? 'UGX' : 'EUR';
}

/** Sandbox collections use EUR with small test amounts, not UGX list prices. */
function mtnChargeAmount(amountUgx) {
  if (process.env.MTN_MOMO_ENV === 'production' || mtnCurrency() === 'UGX') {
    return String(amountUgx);
  }
  return String(process.env.MTN_MOMO_SANDBOX_AMOUNT || '1');
}

function isMtnProductionMsisdn(msisdn) {
  const digits = String(msisdn || '').replace(/\D/g, '');
  return digits.startsWith('2567');
}

function toMtnMsisdn(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('256')) return digits;
  if (digits.startsWith('0')) return `256${digits.slice(1)}`;
  return digits;
}

function planFrequency(plan) {
  switch (plan) {
    case 'monthly':
      return 'RECURRING';
    default:
      return 'ONE_TIME';
  }
}

function validitySecondsForPlan(plan) {
  const days = planDurationDays(plan) || 1;
  return days * 24 * 60 * 60;
}

/** Map MTN pre-approval payload to the app schema. */
function mapPreApprovalRecord(raw, { referenceId, externalId, plan, amount, msisdn } = {}) {
  return {
    preApprovalId: raw?.preApprovalId || raw?.preapprovalId || referenceId || '',
    toFri: raw?.toFri || raw?.payee?.partyId || '',
    fromFri: raw?.fromFri || raw?.payer?.partyId || msisdn || '',
    fromCurrency: raw?.fromCurrency || raw?.payerCurrency || mtnCurrency(),
    createdTime: raw?.createdTime || raw?.createdDate || new Date().toISOString(),
    approvedTime: raw?.approvedTime || raw?.approvedDate || '',
    expiryTime: raw?.expiryTime || raw?.expirationDateTime || '',
    status: raw?.status || 'PENDING',
    message: raw?.message || raw?.reason || raw?.payerMessage || '',
    frequency: raw?.frequency || planFrequency(plan),
    startDate: raw?.startDate || new Date().toISOString().slice(0, 10),
    lastUsedDate: raw?.lastUsedDate || '',
    offer: raw?.offer || `APP_DISPLAY_NAME ${plan || ''}`.trim(),
    externalId: raw?.externalId || externalId || '',
    maxDebitAmount: String(raw?.maxDebitAmount || raw?.amount || amount || ''),
  };
}

async function mtnAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Target-Environment': mtnTargetEnv(),
    'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY,
  };
}

async function mtnCollectionHeaders(token, referenceId, { callbackUrl } = {}) {
  const headers = {
    ...(await mtnAuthHeaders(token)),
    'X-Reference-Id': referenceId,
    'Content-Type': 'application/json',
  };
  if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;
  return headers;
}

async function getMtnAccessToken() {
  const auth = Buffer.from(
    `${process.env.MTN_MOMO_API_USER}:${process.env.MTN_MOMO_API_KEY}`,
  ).toString('base64');

  const response = await fetch(`${mtnMomoBaseUrl()}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('MTN MoMo token failed:', details);
    throw new Error('MTN MoMo credentials are invalid. Check MTN_MOMO_* variables.');
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('MTN MoMo did not return an access token.');
  }
  return payload.access_token;
}

async function initiateMtnPreApproval(phone, plan, amountUgx, metadata = {}) {
  const token = await getMtnAccessToken();
  const referenceId = crypto.randomUUID();
  const externalId = `spark-${plan}-${Date.now()}`;
  const msisdn = toMtnMsisdn(phone);
  const callbackUrl = process.env.MTN_MOMO_CALLBACK_URL || undefined;
  const chargeAmount = mtnChargeAmount(amountUgx);

  const response = await fetch(`${mtnMomoBaseUrl()}/collection/v1_0/preapproval`, {
    method: 'POST',
    headers: await mtnCollectionHeaders(token, referenceId, { callbackUrl }),
    body: JSON.stringify({
      payer: {
        partyIdType: 'MSISDN',
        partyId: msisdn,
      },
      payerCurrency: mtnCurrency(),
      payerMessage: `Approve APP_DISPLAY_NAME ${plan} — up to ${chargeAmount} ${mtnCurrency()}`,
      validityTime: validitySecondsForPlan(plan),
    }),
  });

  if (response.status !== 202 && !response.ok) {
    const details = await response.text();
    console.error('MTN MoMo preApproval failed:', details);
    throw new Error(
      details?.trim()?.slice(0, 280) ||
        'MTN MoMo could not start pre-approval. Use an MTN Uganda number (+2567...).',
    );
  }

  const preApproval = mapPreApprovalRecord(
    {},
    { referenceId, externalId, plan, amount: amountUgx, msisdn },
  );

  return {
    referenceId,
    externalId,
    msisdn,
    status: 'PENDING',
    preApproval,
  };
}

async function getMtnPreApprovalStatus(referenceId) {
  const token = await getMtnAccessToken();

  const response = await fetch(
    `${mtnMomoBaseUrl()}/collection/v1_0/preapproval/${referenceId}`,
    {
      method: 'GET',
      headers: await mtnAuthHeaders(token),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('MTN MoMo preApproval status failed:', details);
    throw new Error(details?.trim()?.slice(0, 280) || 'Could not check MTN pre-approval status.');
  }

  const payload = await response.json().catch(() => ({}));
  return mapPreApprovalRecord(payload, { referenceId });
}

/**
 * GET /collection/v1_0/preapprovals/{accountHolderIdType}/{accountHolderId}
 * @see https://momodeveloper.mtn.com/API-collections#api=collection&operation=GetApprovedPreApprovals
 */
async function getMtnApprovedPreApprovals(phone) {
  const token = await getMtnAccessToken();
  const msisdn = toMtnMsisdn(phone);
  const accountHolderIdType = 'MSISDN';

  const response = await fetch(
    `${mtnMomoBaseUrl()}/collection/v1_0/preapprovals/${accountHolderIdType}/${msisdn}`,
    {
      method: 'GET',
      headers: await mtnAuthHeaders(token),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(details);
    } catch {
      parsed = null;
    }
    if (parsed?.code === 'NOT_SUPPORTED_IN_TARGET_ENVIRONMENT') {
      console.warn('[MTN MoMo] GetApprovedPreApprovals not supported in this environment.');
      return [];
    }
    console.error('MTN MoMo GetApprovedPreApprovals failed:', details);
    throw new Error(
      details?.trim()?.slice(0, 280) || 'Could not load approved MTN pre-approvals.',
    );
  }

  const payload = await response.json().catch(() => []);
  const items = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.preApprovals || payload?.items || [];

  return items.map((item) => mapPreApprovalRecord(item, { msisdn }));
}

function isPreApprovalApproved(record) {
  const status = String(record?.status || '').toUpperCase();
  return status === 'SUCCESSFUL' || status === 'APPROVED' || status === 'ACTIVE';
}

async function verifyMtnPreApproval(referenceId, phone, { externalId } = {}) {
  try {
    const status = await getMtnPreApprovalStatus(referenceId);
    if (isPreApprovalApproved(status)) {
      return { approved: true, preApproval: status, source: 'status' };
    }
  } catch (err) {
    console.warn('[MTN MoMo] PreApproval status check failed, trying approved list:', err.message);
  }

  const approved = await getMtnApprovedPreApprovals(phone);
  const match = approved.find((item) => {
    if (isPreApprovalApproved(item)) {
      if (item.preApprovalId === referenceId) return true;
      if (externalId && item.externalId === externalId) return true;
    }
    return false;
  });

  if (match) {
    return { approved: true, preApproval: match, source: 'approved_list' };
  }

  return { approved: false, preApproval: null, approvedCount: approved.length };
}

async function getMtnRequestToPayStatus(referenceId) {
  const token = await getMtnAccessToken();

  const response = await fetch(
    `${mtnMomoBaseUrl()}/collection/v1_0/requesttopay/${referenceId}`,
    {
      method: 'GET',
      headers: await mtnAuthHeaders(token),
    },
  );

  if (response.status === 404) {
    return { status: 'PENDING', approved: false };
  }

  if (!response.ok) {
    const details = await response.text();
    console.error('MTN MoMo requestToPay status failed:', details);
    throw new Error(details?.trim()?.slice(0, 280) || 'Could not check MTN payment status.');
  }

  const payload = await response.json().catch(() => ({}));
  const status = String(payload.status || 'PENDING').toUpperCase();
  return {
    status,
    approved: status === 'SUCCESSFUL',
    financialTransactionId: payload.financialTransactionId || null,
    payload,
  };
}

async function verifyMtnRequestToPay(referenceId) {
  const result = await getMtnRequestToPayStatus(referenceId);
  return {
    approved: result.approved,
    status: result.status,
    source: 'requesttopay',
    preApproval: null,
  };
}

async function verifyMtnPayment(referenceId, phone, { externalId, preApproval = false } = {}) {
  if (preApproval) {
    return verifyMtnPreApproval(referenceId, phone, { externalId });
  }
  return verifyMtnRequestToPay(referenceId);
}

async function initiateMtnRequestToPay(phone, plan, amountUgx, metadata = {}) {
  const token = await getMtnAccessToken();
  const referenceId = crypto.randomUUID();
  const externalId = `spark-${plan}-${Date.now()}`;
  const msisdn = toMtnMsisdn(phone);
  const chargeAmount = mtnChargeAmount(amountUgx);
  const callbackUrl = process.env.MTN_MOMO_CALLBACK_URL || undefined;

  const response = await fetch(`${mtnMomoBaseUrl()}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: await mtnCollectionHeaders(token, referenceId, { callbackUrl }),
    body: JSON.stringify({
      amount: chargeAmount,
      currency: mtnCurrency(),
      externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: msisdn,
      },
      payerMessage: `APP_DISPLAY_NAME ${plan} subscription`,
      payeeNote: 'APP_DISPLAY_NAME chat access',
    }),
  });

  if (response.status !== 202 && !response.ok) {
    const details = await response.text();
    console.error('MTN MoMo requestToPay failed:', details);
    throw new Error(
      details?.trim()?.slice(0, 280) ||
        'MTN MoMo could not start payment. Use an MTN Uganda number (+2567...).',
    );
  }

  return {
    referenceId,
    externalId,
    msisdn,
    status: 'PENDING',
  };
}

async function initiateMtnPayment(phone, plan, amountUgx, metadata = {}) {
  const msisdn = toMtnMsisdn(phone);
  if (process.env.MTN_MOMO_ENV === 'production' && !isMtnProductionMsisdn(msisdn)) {
    throw new Error('MTN direct payments require an MTN Uganda number (+2567...).');
  }

  if (useMtnPreApproval()) {
    const result = await initiateMtnPreApproval(phone, plan, amountUgx, metadata);
    return { ...result, preApproval: result.preApproval, mode: 'preapproval' };
  }
  const result = await initiateMtnRequestToPay(phone, plan, amountUgx, metadata);
  return { ...result, preApproval: null, mode: 'requesttopay' };
}

module.exports = {
  isMtnMomoConfigured,
  useMtnPreApproval,
  initiateMtnPayment,
  initiateMtnPreApproval,
  initiateMtnRequestToPay,
  getMtnPreApprovalStatus,
  getMtnApprovedPreApprovals,
  verifyMtnPreApproval,
  verifyMtnPayment,
  getMtnRequestToPayStatus,
  mapPreApprovalRecord,
  toMtnMsisdn,
  mtnChargeAmount,
};
