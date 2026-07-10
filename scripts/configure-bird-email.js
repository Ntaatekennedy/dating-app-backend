/**
 * Diagnose / configure Bird email for password reset.
 *
 * Usage:
 *   node scripts/configure-bird-email.js
 *   node scripts/configure-bird-email.js --register mail.yourdomain.com
 *   node scripts/configure-bird-email.js --from noreply@mail.yourdomain.com
 *
 * Requires BIRD_API_KEY in .env or the environment.
 */
require('dotenv').config();

const {
  birdEmailApiBase,
  passwordResetEmailFrom,
  parseBirdError,
} = require('../src/utils/email');

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function birdFetch(path, { method = 'GET', body } = {}) {
  const apiKey = process.env.BIRD_API_KEY || '';
  const apiBase = birdEmailApiBase(apiKey);
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json, text };
}

function printDnsRecords(domain) {
  const records = domain.dns_records || domain.dnsRecords || [];
  if (!records.length) {
    console.log('  (no DNS records returned — open Bird → Email → Domains)');
    return;
  }
  console.log('\nPublish these DNS records:');
  for (const record of records) {
    console.log(
      `  - ${record.type || record.record_type || '?'}  ${record.host || record.name || ''}  →  ${record.value || record.content || ''}`,
    );
  }
}

async function main() {
  const apiKey = process.env.BIRD_API_KEY || '';
  if (!apiKey.startsWith('bk_')) {
    console.error('Missing BIRD_API_KEY (must start with bk_).');
    process.exit(1);
  }

  const from = passwordResetEmailFrom();
  const registerDomain = argValue('--register') || process.env.BIRD_SENDING_DOMAIN || null;
  const setFrom = argValue('--from') || null;

  console.log('Bird email configuration check');
  console.log('------------------------------');
  console.log(`API region base : ${birdEmailApiBase(apiKey)}`);
  console.log(`Workspace ID    : ${process.env.BIRD_WORKSPACE_ID || '(not set)'}`);
  console.log(`EMAIL_PROVIDER  : ${process.env.EMAIL_PROVIDER || '(auto)'}`);
  console.log(`From            : ${from}`);
  console.log('');

  // 1) Sandbox probe — proves API key + email product work
  const sandbox = await birdFetch('/v1/email/messages', {
    method: 'POST',
    body: {
      from,
      to: ['delivered@messagebird.dev'],
      subject: 'Spark Dating Bird email check',
      text: 'Sandbox delivery check',
      html: '<p>Sandbox delivery check</p>',
      category: 'transactional',
    },
  });

  if (sandbox.ok) {
    console.log(`✓ Sandbox send OK (${sandbox.status}) id=${sandbox.json.id || 'n/a'}`);
  } else {
    console.error(`✗ Sandbox send failed (${sandbox.status})`);
    console.error(`  ${parseBirdError(sandbox.text)}`);
    process.exit(1);
  }

  // 2) List domains
  const domains = await birdFetch('/v1/email/domains');
  if (domains.ok) {
    const list = domains.json.results || domains.json.data || domains.json.items || [];
    if (!list.length) {
      console.log('• No custom sending domains registered yet.');
    } else {
      console.log(`✓ Found ${list.length} sending domain(s):`);
      for (const domain of list) {
        const name = domain.domain || domain.name;
        const status = domain.status || 'unknown';
        const sending = domain.capabilities?.sending ?? domain.capabilities?.send;
        console.log(`  - ${name}  status=${status}  sending=${sending}`);
      }
    }
  } else if (domains.status === 403) {
    console.log('• Cannot list domains with this API key (403). Use Bird dashboard → Email → Domains.');
  } else {
    console.log(`• Domain list unavailable (${domains.status}): ${parseBirdError(domains.text)}`);
  }

  // 3) Optional: register a domain
  if (registerDomain) {
    console.log(`\nRegistering sending domain: ${registerDomain}`);
    const created = await birdFetch('/v1/email/domains', {
      method: 'POST',
      body: {
        domain: registerDomain,
        return_path: { name: 'send' },
        tracking: { name: 'links' },
      },
    });
    if (created.ok) {
      console.log(`✓ Domain registered: ${created.json.id || registerDomain}`);
      printDnsRecords(created.json);
      console.log('\nAfter DNS verifies, set Railway/local:');
      console.log(`  PASSWORD_RESET_EMAIL_FROM=noreply@${registerDomain}`);
    } else {
      console.error(`✗ Domain register failed (${created.status})`);
      console.error(`  ${parseBirdError(created.text)}`);
      console.error('  Tip: create the domain in Bird dashboard → Email → Domains if the API key lacks permission.');
    }
  }

  console.log('\nWhat this means for password reset');
  console.log('----------------------------------');
  console.log('Current sender uses Bird onboarding domain limits:');
  console.log('  • Only verified Bird workspace members receive mail');
  console.log('  • Temp mail / random Gmail addresses are rejected (422 OnboardingRecipientNotAllowed)');
  console.log('');
  console.log('Quick test (no custom domain):');
  console.log('  1. Bird dashboard → Settings → Team → Invite members');
  console.log('  2. Invite the exact email used in the Spark app');
  console.log('  3. Accept the invite, then request a password reset again');
  console.log('');
  console.log('Production (any user email):');
  console.log('  1. Bird → Email → Domains → add mail.yourdomain.com');
  console.log('  2. Publish DKIM + return-path CNAME + DMARC');
  console.log('  3. Wait until capabilities.sending is verified');
  console.log('  4. Set PASSWORD_RESET_EMAIL_FROM=noreply@mail.yourdomain.com on Railway');
  console.log('  5. Redeploy api');

  if (setFrom) {
    console.log(`\nRemember to set PASSWORD_RESET_EMAIL_FROM=${setFrom}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
