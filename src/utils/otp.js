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

async function sendOtpSms(phone, code) {
  const provider = process.env.SMS_PROVIDER || 'console';

  if (provider === 'console') {
    console.log(`[OTP] ${phone} -> ${code}`);
    return;
  }

  // Hook for Twilio or other providers via env vars.
  console.log(`[OTP:${provider}] ${phone} -> ${code}`);
}

module.exports = {
  normalizePhone,
  generateOtpCode,
  sendOtpSms,
};
