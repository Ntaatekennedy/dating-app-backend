/**
 * Send a test email through Resend (same SDK as password reset).
 *
 * Usage:
 *   1. Set RESEND_API_KEY in .env (replace re_xxxxxxxxx with your real key)
 *   2. npm run resend:test
 *   3. npm run resend:test -- --to you@example.com
 *
 * With onboarding@resend.dev, Resend only delivers to the email on your Resend account.
 */
require('dotenv').config();

const { Resend } = require('resend');
const { passwordResetEmailFrom, parseResendError } = require('../src/utils/email');

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey.startsWith('re_')) {
    console.error('Missing RESEND_API_KEY in .env.');
    console.error('1. Open https://resend.com/onboarding and sign in');
    console.error('2. Create a key at https://resend.com/api-keys');
    console.error('3. Set RESEND_API_KEY=re_... in backend/.env (replace re_xxxxxxxxx with your real key)');
    process.exit(1);
  }

  const to = argValue('--to') || process.env.TEMPMAIL_EMAIL || 'ntaatekennedy96@gmail.com';
  const from = passwordResetEmailFrom();
  const resend = new Resend(apiKey);

  console.log('Resend test email');
  console.log(`  from : ${from}`);
  console.log(`  to   : ${to}`);
  console.log('');

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  if (error) {
    console.error('Failed:', parseResendError(error));
    process.exit(1);
  }

  console.log('Sent successfully.');
  console.log(`  message id: ${data?.id || '(none)'}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
