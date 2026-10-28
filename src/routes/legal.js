const express = require('express');
const { APP_DISPLAY_NAME } = require('../constants');

const router = express.Router();

const SUPPORT_EMAIL = 'privacy@sparkdating.app';
const LEGAL_EMAIL = 'legal@sparkdating.app';

function page(title, sections, footerExtra = '') {
  const body = sections
    .map(
      (s) => `
    <section>
      <h2>${s.heading}</h2>
      <p>${s.body}</p>
    </section>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} — ${APP_DISPLAY_NAME}</title>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      line-height: 1.6;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px 48px;
      color: #1f2937;
      background: #fff;
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; color: #111827; }
    .updated { color: #6b7280; font-size: 0.95rem; margin-bottom: 2rem; }
    h2 { font-size: 1.15rem; margin-top: 1.75rem; color: #111827; }
    p { margin: 0.5rem 0 0; }
    a { color: #e94057; }
    footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.9rem; }
    ol, ul { padding-left: 1.25rem; }
    li { margin: 0.35rem 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="updated">${APP_DISPLAY_NAME} · Last updated: July 2026</p>
  ${body}
  <footer>
    <p>Contact: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    ${footerExtra}
    <p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/child-safety">Child safety standards</a> · <a href="/delete-data">Delete data</a> · <a href="/account-deletion">Delete account</a></p>
  </footer>
</body>
</html>`;
}

const privacySections = [
  {
    heading: 'Introduction',
    body:
      `${APP_DISPLAY_NAME} ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use the ${APP_DISPLAY_NAME} app and related services.`,
  },
  {
    heading: 'Information we collect',
    body:
      'We collect information you provide directly, including your email, display name, date of birth, gender, preferences, profile details, photos, messages, and optional phone number. We also collect usage data such as matches, likes, and activity timestamps to operate and improve the service.',
  },
  {
    heading: 'How we use your information',
    body:
      `We use your information to create and manage your account, show you potential matches, enable messaging, improve safety features such as block and report, send account-related notifications, and maintain the security and performance of ${APP_DISPLAY_NAME}.`,
  },
  {
    heading: 'Profile visibility',
    body:
      `Your profile information and photos are visible to other ${APP_DISPLAY_NAME} users according to your preferences and app features. Phone numbers are masked from other users unless you choose to share contact details through in-app features.`,
  },
  {
    heading: 'Data retention and deletion',
    body:
      'We retain your data while your account is active. You may delete your account at any time from Profile settings in the app. See our <a href="/account-deletion">account deletion page</a> for step-by-step instructions.',
  },
  {
    heading: 'Security',
    body:
      'We use reasonable technical and organizational measures to protect your information, including encrypted connections (HTTPS) for data in transit. No method of transmission or storage is completely secure.',
  },
  {
    heading: 'Children',
    body: `${APP_DISPLAY_NAME} is for adults 18 years and older. We do not knowingly collect data from children.`,
  },
  {
    heading: 'Contact',
    body: `If you have questions about this Privacy Policy or your data, contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
  },
];

const termsSections = [
  {
    heading: 'Agreement',
    body:
      `By creating an account or using ${APP_DISPLAY_NAME}, you agree to these Terms of Service. If you do not agree, do not use the app.`,
  },
  {
    heading: 'Eligibility',
    body:
      `You must be at least 18 years old to use ${APP_DISPLAY_NAME}. You are responsible for ensuring that your account information is accurate and that you meet the minimum age requirement.`,
  },
  {
    heading: 'Your account',
    body:
      'You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.',
  },
  {
    heading: 'Acceptable use',
    body:
      `You agree not to harass, abuse, impersonate others, post illegal content, spam users, or use ${APP_DISPLAY_NAME} for commercial solicitation without permission.`,
  },
  {
    heading: 'Safety',
    body:
      `${APP_DISPLAY_NAME} provides block and report tools. We may review reports and take action, including content removal or account suspension, at our discretion.`,
  },
  {
    heading: 'Subscriptions',
    body:
      'Some features may require a paid subscription. Prices and duration are shown in the app before purchase. Subscriptions are time-limited and do not auto-renew unless stated otherwise at checkout.',
  },
  {
    heading: 'Termination',
    body:
      'You may delete your account at any time from Profile settings. See <a href="/account-deletion">account deletion</a> for instructions.',
  },
  {
    heading: 'Contact',
    body: `Questions about these Terms may be sent to <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a>.`,
  },
];

router.get('/privacy', (_req, res) => {
  res.type('html').send(page('Privacy Policy', privacySections));
});

router.get('/terms', (_req, res) => {
  res.type('html').send(page('Terms of Service', termsSections));
});

router.get('/account-deletion', (_req, res) => {
  const sections = [
    {
      heading: `Delete your ${APP_DISPLAY_NAME} account`,
      body:
        `You can delete your account and associated personal data directly in the ${APP_DISPLAY_NAME} app. Account deletion is permanent and cannot be undone.`,
    },
    {
      heading: 'Steps in the app',
      body: `<ol>
        <li>Open the <strong>${APP_DISPLAY_NAME}</strong> app and sign in.</li>
        <li>Go to the <strong>Profile</strong> tab (bottom navigation).</li>
        <li>Scroll down and tap <strong>Delete account</strong>.</li>
        <li>Confirm when prompted.</li>
      </ol>`,
    },
    {
      heading: 'What is deleted',
      body:
        'When you delete your account, we remove your profile, photos, preferences, and associated personal data from our systems, subject to limited retention required for security, fraud prevention, or legal compliance.',
    },
    {
      heading: 'Need help?',
      body: `If you cannot access the app, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> from your registered email address and request account deletion.`,
    },
  ];

  res.type('html').send(page('Account deletion', sections));
});

router.get('/delete-data', (_req, res) => {
  const sections = [
    {
      heading: `Request deletion of your data (${APP_DISPLAY_NAME})`,
      body:
        'You can delete some or all of your personal data without deleting your entire account, or you can delete your account completely. This page explains your options.',
    },
    {
      heading: 'Delete photos (keep your account)',
      body: `<ol>
        <li>Open the <strong>${APP_DISPLAY_NAME}</strong> app and sign in.</li>
        <li>Go to <strong>Profile</strong> → <strong>Edit profile</strong>.</li>
        <li>Tap a photo and choose <strong>Remove photo</strong>, or use the photo gallery to delete individual images.</li>
      </ol>`,
    },
    {
      heading: 'Delete messages (keep your account)',
      body: `<ol>
        <li>Open the <strong>Chats</strong> tab.</li>
        <li>Open a conversation.</li>
        <li>Use the option to remove or delete the chat — this deletes messages for that conversation.</li>
      </ol>`,
    },
    {
      heading: 'Update or remove profile information',
      body:
        'You can edit your display name, bio, preferences, and other profile fields anytime from <strong>Profile</strong> → <strong>Edit profile</strong> without deleting your account.',
    },
    {
      heading: 'Request deletion of other data',
      body: `Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> from your registered email address. Include your ${APP_DISPLAY_NAME} account email and describe what data you want deleted. We will respond within a reasonable time.`,
    },
    {
      heading: 'Delete your entire account',
      body:
        'To remove all data at once, see our <a href="/account-deletion">account deletion</a> page.',
    },
  ];

  res.type('html').send(page('Delete your data', sections));
});

router.get('/child-safety', (_req, res) => {
  const sections = [
    {
      heading: `${APP_DISPLAY_NAME} — Child safety standards`,
      body:
        `${APP_DISPLAY_NAME} is an adults-only (18+) dating application. We maintain zero tolerance for child sexual abuse and exploitation (CSAE), including any content that sexualizes, grooms, or endangers minors.`,
    },
    {
      heading: 'Age requirement',
      body:
        'Users must be at least 18 years old to create an account. Date of birth is collected at registration to enforce this requirement. Accounts suspected of belonging to minors are removed.',
    },
    {
      heading: 'Prohibited content and conduct',
      body:
        `The following are strictly prohibited on ${APP_DISPLAY_NAME}: sexual content involving minors; grooming or solicitation of minors; sharing, requesting, or distributing CSAM; impersonation of minors; and any conduct that endangers children.`,
    },
    {
      heading: 'In-app reporting and blocking',
      body:
        'Users can block other users and report profiles or messages from within the app. Reports may be reviewed and can result in content removal, account suspension, or permanent ban.',
    },
    {
      heading: 'Moderation and enforcement',
      body:
        `${APP_DISPLAY_NAME} reviews user reports and may take enforcement action at our discretion, including removing content, restricting features, or terminating accounts that violate these standards or our Terms of Service.`,
    },
    {
      heading: `Reporting to ${APP_DISPLAY_NAME}`,
      body: `To report CSAE concerns or urgent safety issues, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with as much detail as possible (usernames, screenshots, and timestamps help us investigate faster).`,
    },
    {
      heading: 'Cooperation with authorities',
      body:
        'We comply with applicable laws and cooperate with law enforcement and recognized child safety organizations when we become aware of content or conduct involving the sexual abuse or exploitation of children.',
    },
    {
      heading: 'Related policies',
      body:
        'See also our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.',
    },
  ];

  res.type('html').send(page('Child safety standards', sections));
});

module.exports = router;
