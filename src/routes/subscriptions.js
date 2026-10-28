const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapSubscription } = require('../utils/mappers');
const { planDurationDays, maskPhone } = require('../utils/helpers');
const { planPriceUgx, planLabel, sendPaymentPromptSms, isAnyMobileMoneyProviderConfigured } = require('../utils/mobileMoney');
const { getMtnPreApprovalStatus, getMtnApprovedPreApprovals, verifyMtnPreApproval, verifyMtnPayment, isMtnMomoConfigured } = require('../utils/mtnMomo');
const { verifyFlutterwaveCharge, isFlutterwaveConfigured, listFlutterwaveCustomers } = require('../utils/flutterwave');
const { verifyPesapalPayment, isPesapalConfigured } = require('../utils/pesapal');
const { APP_DISPLAY_NAME } = require('../constants');

const router = express.Router();

const subscriptionsEnabled = process.env.SUBSCRIPTIONS_ENABLED === 'true';

async function getActiveSubscription(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND is_active = TRUE AND plan != 'free'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY expires_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function verifyMobileMoneyPaymentDetails({
  channel,
  chargeId,
  referenceId,
  paymentPhone,
  externalId,
  simulated,
}) {
  if (simulated === true) {
    return { approved: true, simulated: true, source: 'simulate' };
  }

  if (channel === 'pesapal') {
    const trackingId = chargeId || referenceId;
    if (!trackingId) {
      throw new Error('orderTrackingId is required for PesaPal verification');
    }
    const result = await verifyPesapalPayment(trackingId);
    return {
      approved: result.approved,
      status: result.status,
      source: 'pesapal',
    };
  }

  if (channel === 'flutterwave') {
    if (!chargeId) {
      throw new Error('chargeId is required for Flutterwave verification');
    }
    const result = await verifyFlutterwaveCharge(chargeId);
    return {
      approved: result.approved,
      status: result.status,
      source: 'flutterwave',
    };
  }

  if (channel === 'mtn_momo') {
    if (!referenceId) {
      throw new Error('referenceId is required for MTN MoMo verification');
    }
    const result = await verifyMtnPayment(referenceId, paymentPhone, {
      externalId,
      preApproval: false,
    });
    return {
      approved: result.approved,
      status: result.status || 'UNKNOWN',
      source: result.source,
      preApproval: result.preApproval,
    };
  }

  if (channel === 'mtn_momo_preapproval') {
    if (!referenceId || !paymentPhone) {
      throw new Error('referenceId and paymentPhone are required');
    }
    const result = await verifyMtnPreApproval(referenceId, paymentPhone, { externalId });
    return {
      approved: result.approved,
      status: result.preApproval?.status || 'UNKNOWN',
      source: result.source,
      preApproval: result.preApproval,
      approvedCount: result.approvedCount ?? 0,
    };
  }

  if (!referenceId || !paymentPhone) {
    throw new Error('referenceId and paymentPhone are required');
  }
  const result = await verifyMtnPreApproval(referenceId, paymentPhone, { externalId });
  return {
    approved: result.approved,
    status: result.preApproval?.status || 'UNKNOWN',
    source: result.source,
    preApproval: result.preApproval,
    approvedCount: result.approvedCount ?? 0,
  };
}

function resolveStoredPayment(paymentMethod, paymentPhone) {
  const method = paymentMethod === 'paypal'
    ? 'paypal'
    : paymentMethod === 'card'
      ? 'card'
      : 'phone';

  if (method === 'paypal') {
    return 'PayPal';
  }
  if (method === 'card') {
    const cardRef = (paymentPhone || '').trim();
    if (!cardRef) {
      throw new Error('Enter valid card details');
    }
    return cardRef;
  }
  const phone = (paymentPhone || '').trim();
  if (!phone) {
    throw new Error('Enter a phone number to pay with');
  }
  return phone;
}

async function createPaidSubscription(userId, plan, paymentMethod, paymentPhone) {
  if (!plan || plan === 'free') {
    throw new Error('Invalid plan');
  }

  const storedPayment = resolveStoredPayment(paymentMethod, paymentPhone);

  await pool.query(
    `UPDATE subscriptions SET is_active = FALSE
     WHERE user_id = ? AND plan != 'free' AND is_active = TRUE`,
    [userId],
  );

  const days = planDurationDays(plan);
  const id = uuidv4();
  await pool.query(
    `INSERT INTO subscriptions (id, user_id, plan, starts_at, expires_at, is_active, payment_phone)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), TRUE, ?)`,
    [id, userId, plan, days, storedPayment],
  );

  const [[row]] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [id]);
  return row;
}

function parseSparkMerchantReference(merchantReference) {
  const match = /^spark-(daily|weekly|monthly)-([a-z0-9]+)-/i.exec(String(merchantReference || '').trim());
  if (!match) return null;
  return { plan: match[1].toLowerCase(), userPrefix: match[2] };
}

async function findUserIdByPrefix(userPrefix) {
  const [users] = await pool.query('SELECT id FROM users WHERE id LIKE ? LIMIT 1', [`${userPrefix}%`]);
  return users[0]?.id || null;
}

async function activateSubscriptionFromPesapalIpn(orderTrackingId, merchantReference) {
  const result = await verifyPesapalPayment(orderTrackingId);
  if (!result.approved) {
    return { activated: false, status: result.status };
  }

  const parsed = parseSparkMerchantReference(merchantReference || result.payload?.merchant_reference);
  if (!parsed) {
    console.warn('[PesaPal IPN] Could not parse merchant reference:', merchantReference);
    return { activated: false, status: result.status };
  }

  const userId = await findUserIdByPrefix(parsed.userPrefix);
  if (!userId) {
    console.warn('[PesaPal IPN] No user for prefix:', parsed.userPrefix);
    return { activated: false, status: result.status };
  }

  const account = String(result.payload?.payment_account || '').trim();
  const paymentPhone = account
    ? (account.startsWith('+') ? account : `+256${account.replace(/^0/, '')}`)
    : '+256';

  await createPaidSubscription(userId, parsed.plan, 'phone', paymentPhone);
  console.log('[PesaPal IPN] Subscription activated for', userId, parsed.plan);
  return { activated: true, status: result.status, userId, plan: parsed.plan };
}

router.get('/status', authRequired, async (req, res) => {
  try {
    const sub = await getActiveSubscription(req.user.userId);
    res.json({
      hasChatAccess: !subscriptionsEnabled || !!sub,
      activeSubscription: sub ? mapSubscription(sub) : null,
      paymentProviders: {
        pesapal: isPesapalConfigured(),
        flutterwave: isFlutterwaveConfigured(),
        mtn: isMtnMomoConfigured(),
        ready: isAnyMobileMoneyProviderConfigured(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load subscription status' });
  }
});

router.get('/flutterwave/customers', authRequired, async (req, res) => {
  try {
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({
        error: 'Flutterwave is not configured. Set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET.',
      });
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(10, Number(req.query.size) || 10));
    const payload = await listFlutterwaveCustomers(page, size);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to list Flutterwave customers' });
  }
});

router.post('/mobile-money/prompt', authRequired, async (req, res) => {
  try {
    const { plan, paymentPhone } = req.body;

    if (!plan || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!isAnyMobileMoneyProviderConfigured()) {
      return res.status(503).json({
        error:
          'Mobile money is not configured on this server. ' +
          'Add PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET (or MTN MoMo credentials).',
      });
    }

    const [[userRow]] = await pool.query('SELECT email FROM users WHERE id = ?', [req.user.userId]);

    const result = await sendPaymentPromptSms(paymentPhone, plan, {
      userId: req.user.userId,
      customerEmail: userRow?.email || null,
    });
    const amountUgx = planPriceUgx(plan);

    if (!result.delivered) {
      return res.status(502).json({
        error:
          'Could not start mobile money checkout on this phone. ' +
          'Ask the server admin to set AFRICAS_TALKING_PAYMENT_PRODUCT_NAME.',
      });
    }

    res.json({
      sent: true,
      channel: result.channel,
      phone: result.phone,
      transactionId: result.transactionId || null,
      externalId: result.externalId || result.preApproval?.externalId || null,
      simulated: result.simulated === true,
      preApproval: result.preApproval || null,
      maskedPhone: maskPhone(result.phone),
      amountUgx,
      planLabel: planLabel(plan),
      message: result.simulated
        ? 'Test mode — no real popup was sent.'
        : result.channel === 'pesapal'
          ? result.paymentInstruction ||
          'Open the PesaPal payment page and pay with Mobile Money.'
          : result.channel === 'flutterwave'
            ? result.paymentInstruction ||
            'Flutterwave mobile money prompt sent to this phone. Enter your PIN to approve.'
            : result.channel === 'mtn_momo_preapproval'
              ? 'MTN pre-approval popup sent to this phone. Enter your PIN to approve.'
              : result.channel === 'mtn_momo'
                ? 'MTN Mobile Money popup sent to this phone. Enter your PIN to approve.'
                : 'A mobile money popup was sent to this phone. Enter your PIN to approve the payment.',
      chargeReference: result.chargeReference || null,
      merchantReference: result.merchantReference || null,
      redirectUrl: result.redirectUrl || null,
      network: result.network || null,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to send mobile money prompt' });
  }
});

router.get('/mobile-money/preapproval/:referenceId', authRequired, async (req, res) => {
  try {
    const preApproval = await getMtnPreApprovalStatus(req.params.referenceId);
    res.json({ preApproval });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to load pre-approval status' });
  }
});

/** GetApprovedPreApprovals — list approved mandates for a phone (MSISDN). */
router.get('/mobile-money/preapprovals', authRequired, async (req, res) => {
  try {
    const phone = (req.query.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'phone query parameter is required' });
    }
    const preApprovals = await getMtnApprovedPreApprovals(phone);
    res.json({ preApprovals });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to load approved pre-approvals' });
  }
});

router.post('/mobile-money/verify', authRequired, async (req, res) => {
  try {
    const result = await verifyMobileMoneyPaymentDetails(req.body);
    if (!result.approved) {
      return res.status(402).json({
        error: result.status === 'PENDING' || result.status === 'INVALID'
          ? 'Payment not completed yet. Finish Mobile Money on the PesaPal page, then try again.'
          : 'Payment not confirmed yet. Enter your PIN on the mobile money popup, then try again.',
        approved: false,
        status: result.status,
        approvedCount: result.approvedCount ?? 0,
      });
    }
    res.json({
      approved: true,
      status: result.status,
      source: result.source,
      preApproval: result.preApproval,
      simulated: result.simulated === true,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to verify mobile money payment' });
  }
});

/** Verify payment and activate subscription in one round trip. */
router.post('/mobile-money/complete', authRequired, async (req, res) => {
  try {
    const { plan, paymentPhone, paymentMethod, simulated, ...verifyInput } = req.body;
    if (!plan || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const result = await verifyMobileMoneyPaymentDetails({
      ...verifyInput,
      paymentPhone,
      simulated,
    });
    if (!result.approved) {
      return res.status(402).json({
        error: result.status === 'PENDING' || result.status === 'INVALID'
          ? 'Payment not completed yet. Finish Mobile Money on the PesaPal page, then try again.'
          : 'Payment not confirmed yet. Enter your PIN on the mobile money popup, then try again.',
        approved: false,
        status: result.status,
      });
    }

    const row = await createPaidSubscription(
      req.user.userId,
      plan,
      paymentMethod || 'phone',
      paymentPhone,
    );
    res.status(201).json({
      ...mapSubscription(row),
      hasChatAccess: true,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to complete mobile money payment' });
  }
});

router.post('/mobile-money/preapproval/verify', authRequired, async (req, res) => {
  try {
    const { referenceId, paymentPhone, externalId, simulated } = req.body;
    if (simulated === true) {
      return res.json({ approved: true, simulated: true });
    }
    if (!referenceId || !paymentPhone) {
      return res.status(400).json({ error: 'referenceId and paymentPhone are required' });
    }
    const result = await verifyMtnPreApproval(referenceId, paymentPhone, { externalId });
    if (!result.approved) {
      return res.status(402).json({
        error: 'Pre-approval not confirmed yet. Enter your PIN on the MTN popup, then try again.',
        approved: false,
        approvedCount: result.approvedCount ?? 0,
      });
    }
    res.json({
      approved: true,
      preApproval: result.preApproval,
      source: result.source,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to verify pre-approval' });
  }
});

/** PesaPal redirects the customer's browser here after checkout (GET). */
router.get('/pesapal/callback', async (req, res) => {
  const orderTrackingId = (req.query.OrderTrackingId || req.query.orderTrackingId || '').trim();
  const merchantReference = (req.query.OrderMerchantReference || req.query.orderMerchantReference || '').trim();

  let status = 'UNKNOWN';
  let approved = false;

  if (orderTrackingId) {
    try {
      const result = await verifyPesapalPayment(orderTrackingId);
      status = result.status;
      approved = result.approved;
    } catch (err) {
      console.error('[PesaPal callback]', err.message);
      status = 'ERROR';
    }
  }

  const title = approved ? 'Payment received' : 'Payment pending';
  const message = approved
    ? `Your payment was successful. Return to the ${APP_DISPLAY_NAME} app — chat access will unlock automatically.`
    : orderTrackingId
      ? status === 'PENDING' || status === 'INVALID'
        ? `Your payment is still processing. Return to the ${APP_DISPLAY_NAME} app and wait a moment.`
        : `We could not confirm payment yet. Return to the ${APP_DISPLAY_NAME} app and wait, or try again.`
      : `Missing payment reference from PesaPal. Return to the ${APP_DISPLAY_NAME} app and try again.`;

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1.5rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { line-height: 1.5; color: #444; }
    .meta { margin-top: 1.5rem; font-size: 0.875rem; color: #666; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <div class="meta">
    ${orderTrackingId ? `<div>Reference: ${orderTrackingId}</div>` : ''}
    ${merchantReference ? `<div>Order: ${merchantReference}</div>` : ''}
    <div>Status: ${status}</div>
  </div>
</body>
</html>`);
});

/** PesaPal IPN — server-to-server notification (registered as GET). */
router.get('/pesapal/ipn', async (req, res) => {
  const orderTrackingId = (req.query.OrderTrackingId || req.query.orderTrackingId || '').trim();
  const merchantReference = (req.query.OrderMerchantReference || req.query.orderMerchantReference || '').trim();
  const orderNotificationType = req.query.OrderNotificationType || 'IPNCHANGE';

  let status = 200;
  if (orderTrackingId) {
    try {
      const outcome = await activateSubscriptionFromPesapalIpn(orderTrackingId, merchantReference);
      console.log('[PesaPal IPN]', orderTrackingId, outcome.status, merchantReference, outcome.activated ? 'activated' : 'pending');
    } catch (err) {
      console.error('[PesaPal IPN]', err.message);
      status = 500;
    }
  } else {
    status = 500;
  }

  res.json({
    orderNotificationType,
    orderTrackingId,
    orderMerchantReference: merchantReference,
    status,
  });
});

router.post('/purchase', authRequired, async (req, res) => {
  try {
    const { plan, paymentPhone, paymentMethod } = req.body;
    const row = await createPaidSubscription(req.user.userId, plan, paymentMethod, paymentPhone);
    res.status(201).json({
      ...mapSubscription(row),
      hasChatAccess: true,
    });
  } catch (err) {
    console.error(err);
    const status = err.message === 'Invalid plan' ||
      err.message === 'Enter valid card details' ||
      err.message === 'Enter a phone number to pay with'
      ? 400
      : 500;
    res.status(status).json({ error: err.message || 'Purchase failed' });
  }
});

module.exports = router;
