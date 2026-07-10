function resolveBirdApiKey() {
  return process.env.BIRD_API_KEY || '';
}

function resolveTermiiApiKey() {
  return (
    process.env.TERMII_API_KEY ||
    process.env.OTP_API_KEY ||
    process.env.AFRICAS_TALKING_API_KEY ||
    ''
  );
}

function birdEmailApiBase(apiKey) {
  if (process.env.BIRD_EMAIL_API_BASE) {
    return process.env.BIRD_EMAIL_API_BASE.replace(/\/$/, '');
  }
  if (apiKey?.startsWith('bk_eu1_')) return 'https://eu1.platform.bird.com';
  if (apiKey?.startsWith('bk_us1_')) return 'https://us1.platform.bird.com';
  return 'https://eu1.platform.bird.com';
}

function termiiBaseUrl() {
  const base = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';
  return base.replace(/\/$/, '');
}

function isBirdEmailConfigured() {
  const apiKey = resolveBirdApiKey();
  return apiKey.startsWith('bk_');
}

function isTermiiEmailConfigured() {
  const apiKey = resolveTermiiApiKey();
  const configId = process.env.TERMII_EMAIL_CONFIG_ID;
  return !!(apiKey && configId);
}

function isEmailOtpConfigured() {
  return isBirdEmailConfigured() || isTermiiEmailConfigured();
}

function isOnboardingSender(address) {
  return /@messagebird\.dev$/i.test(String(address || '').replace(/.*</, '').replace(/>.*/, '').trim());
}

function passwordResetEmailFrom() {
  const explicit = process.env.PASSWORD_RESET_EMAIL_FROM;
  if (explicit?.includes('<')) return explicit;
  // Bird shared onboarding domain — only delivers to verified workspace members.
  const address = explicit || 'onboarding@messagebird.dev';
  const name = process.env.PASSWORD_RESET_EMAIL_FROM_NAME || 'Spark Dating';
  return `${name} <${address}>`;
}

function passwordResetEmailSubject() {
  return process.env.PASSWORD_RESET_EMAIL_SUBJECT || 'Spark Dating password reset code';
}

function passwordResetEmailBody(code) {
  const ttl = process.env.OTP_TTL_MINUTES || '5';
  return (
    process.env.PASSWORD_RESET_EMAIL_BODY?.replace('{code}', code).replace('{ttl}', ttl) ||
    `Your Spark Dating password reset code is ${code}. It expires in ${ttl} minutes. If you did not request this, ignore this email.`
  );
}

function passwordResetEmailHtml(code) {
  const body = passwordResetEmailBody(code);
  return (
    process.env.PASSWORD_RESET_EMAIL_HTML?.replace('{code}', code) ||
    `<p>${body}</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p>`
  );
}

function parseBirdError(details) {
  try {
    const payload = JSON.parse(details);
    const err = payload?.error || payload;
    const name = err?.name || err?.code || '';
    const message = err?.message || '';
    const remediation = err?.remediation || '';

    if (name === 'OnboardingRecipientNotAllowed' || /onboarding domain/i.test(message)) {
      return (
        'Bird can only email verified workspace members while using onboarding@messagebird.dev. ' +
        'Invite this address in Bird → Settings → Team, or verify your own sending domain and set PASSWORD_RESET_EMAIL_FROM.'
      );
    }
    if (name === 'OnboardingSendLimitExceeded' || /daily/i.test(message)) {
      return 'Bird onboarding email daily limit reached. Try again tomorrow or verify a custom sending domain.';
    }
    if (name === 'SenderDomainNotVerified' || /not verified/i.test(message)) {
      return (
        'Bird sending domain is not verified yet. Finish DNS (DKIM, return-path, DMARC) in Bird → Email → Domains, ' +
        'then set PASSWORD_RESET_EMAIL_FROM to an address on that domain.'
      );
    }
    if (message) {
      return remediation ? `${message} ${remediation}` : message;
    }
  } catch {
    // fall through
  }
  return details?.trim() ? details.trim().slice(0, 280) : 'Failed to deliver email';
}

async function sendBirdEmail(to, subject, text, html) {
  const apiKey = resolveBirdApiKey();
  const apiBase = birdEmailApiBase(apiKey);
  const from = passwordResetEmailFrom();

  if (isOnboardingSender(from)) {
    console.warn(
      '[Email] Sending from Bird onboarding domain. Recipients must be verified Bird workspace members ' +
        'unless you verify a custom domain.',
    );
  }

  const response = await fetch(`${apiBase}/v1/email/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      category: 'transactional',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Bird email failed:', details);
    throw new Error(parseBirdError(details));
  }

  const payload = await response.json().catch(() => ({}));
  return {
    id: payload.id || null,
    status: payload.status || 'accepted',
  };
}

async function sendTermiiEmailOtp(email, code) {
  const apiKey = resolveTermiiApiKey();
  const emailConfigId = process.env.TERMII_EMAIL_CONFIG_ID;

  const response = await fetch(`${termiiBaseUrl()}/api/email/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      email_address: email,
      code: String(code),
      email_configuration_id: emailConfigId,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Termii email OTP failed:', details);
    throw new Error('Failed to deliver email');
  }

  const payload = await response.json().catch(() => ({}));
  if (payload.code && payload.code !== 'ok') {
    console.error('Termii email OTP rejected:', payload);
    throw new Error(payload.message || 'Failed to deliver email');
  }
}

function resolveEmailProvider() {
  const configured = process.env.EMAIL_PROVIDER;
  if (configured) return configured;
  if (isBirdEmailConfigured()) return 'bird';
  if (isTermiiEmailConfigured()) return 'termii';
  return 'console';
}

async function sendPasswordResetEmail(email, code) {
  const provider = resolveEmailProvider();
  const subject = passwordResetEmailSubject();
  const text = passwordResetEmailBody(code);
  const html = passwordResetEmailHtml(code);

  if (provider === 'bird') {
    if (!isBirdEmailConfigured()) {
      console.warn('[Email] Bird email is not configured (missing BIRD_API_KEY).');
      console.log(`[Password reset email] ${email} -> ${code}`);
      return { delivered: false, channel: 'console' };
    }
    const result = await sendBirdEmail(email, subject, text, html);
    return { delivered: true, channel: 'bird', messageId: result.id };
  }

  if (provider === 'termii') {
    if (!isTermiiEmailConfigured()) {
      console.warn('[Email] Termii email OTP is not fully configured (missing TERMII_EMAIL_CONFIG_ID).');
      console.log(`[Password reset email] ${email} -> ${code}`);
      return { delivered: false, channel: 'console' };
    }
    await sendTermiiEmailOtp(email, code);
    return { delivered: true, channel: 'termii' };
  }

  if (provider === 'console') {
    console.log(`[Password reset email] ${email} -> ${code}`);
    return { delivered: false, channel: 'console' };
  }

  console.log(`[Password reset email] ${email} -> ${code}`);
  return { delivered: false, channel: provider };
}

module.exports = {
  sendPasswordResetEmail,
  isEmailOtpConfigured,
  passwordResetEmailSubject,
  passwordResetEmailBody,
  birdEmailApiBase,
  passwordResetEmailFrom,
  parseBirdError,
};
