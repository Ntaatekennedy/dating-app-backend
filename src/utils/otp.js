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

async function sendTwilioSms(phone, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('SMS service is not configured');
  }

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

  if (!username || !apiKey) {
    throw new Error('SMS service is not configured');
  }

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
  const provider = process.env.SMS_PROVIDER || 'africas_talking';

  if (provider === 'twilio') {
    await sendTwilioSms(phone, code);
    return;
  }

  if (provider === 'africas_talking') {
    await sendAfricasTalkingSms(phone, code);
    return;
  }

  if (provider === 'console') {
    console.log(`[OTP] ${phone} -> ${code}`);
    return;
  }

  throw new Error(`Unsupported SMS provider: ${provider}`);
}

module.exports = {
  normalizePhone,
  generateOtpCode,
  sendOtpSms,
};
