const bcrypt = require('bcryptjs');

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

async function verifyPassword(plain, stored) {
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

function planDurationDays(plan) {
  switch (plan) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    default:
      return 0;
  }
}

function orderedPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

function maskPhone(phone) {
  if (!phone?.trim()) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);

  const prefixLen = trimmed.startsWith('+') ? 4 : 2;
  const prefix = trimmed.slice(0, Math.min(prefixLen, trimmed.length));
  const suffix = digits.slice(-3);
  const prefixDigits = prefix.replace(/\D/g, '').length;
  const hiddenCount = Math.max(digits.length - prefixDigits - 3, 3);
  const stars = '*'.repeat(hiddenCount);
  return `${prefix} ${stars} ${suffix}`;
}

module.exports = {
  haversineKm,
  calculateAge,
  verifyPassword,
  planDurationDays,
  orderedPair,
  maskPhone,
};
