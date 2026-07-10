# Email setup (password reset)

Password reset codes are sent by **Bird Email** to the user's registered email address. The code is never shown in the app UI.

## Root cause of “email not received”

Bird API keys and sending **work**. A sandbox send to `delivered@messagebird.dev` returns `202 Accepted`.

The blocker is the **sender**:

| Sender | Who can receive mail |
|--------|----------------------|
| `onboarding@messagebird.dev` (current) | Only **verified Bird workspace members** (+ sandbox addresses) |
| `noreply@your-verified-domain.com` | Any real inbox (production) |

Bird rejects everyone else with:

`422 OnboardingRecipientNotAllowed`

So Gmail / Yahoo / `devflow@tokmail.net` will **not** get reset codes until either:

1. That address is invited into Bird → **Settings → Team**, or  
2. You verify a **custom sending domain** and change `PASSWORD_RESET_EMAIL_FROM`.

## Production / local config

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `bird` |
| `BIRD_WORKSPACE_ID` | `ws_01kwy5m1she1m8a1jm5g7dmqf8` |
| `BIRD_API_KEY` | Your `bk_eu1_...` key from [bird.com/dashboard](https://bird.com/dashboard) |
| `PASSWORD_RESET_EMAIL_FROM` | `onboarding@messagebird.dev` until a domain is verified, then `noreply@mail.yourdomain.com` |
| `PASSWORD_RESET_EMAIL_FROM_NAME` | `Spark Dating` |

**Important:** `devflow@tokmail.net` is a **test inbox** (receive only). Never use it as `PASSWORD_RESET_EMAIL_FROM`.

Docs: [Sending email](https://bird.com/en-us/docs/guides/email/sending-email/) · [Sending domains](https://bird.com/en-us/docs/guides/email/sending-domains)

## Configure Bird (choose one path)

### Path A — Quick test (no domain)

1. Open [Bird dashboard](https://bird.com/dashboard) → **Settings → Team**
2. **Invite members** → enter the **exact** email used in Spark (e.g. your Gmail)
3. Accept the invite from that inbox
4. In the app: Forgot password → send code → check inbox + spam

### Path B — Production (any user)

1. Bird → **Email → Domains** → add a subdomain (recommended: `mail.yourdomain.com`)
2. Publish the DNS records Bird shows (DKIM TXT, return-path CNAME, DMARC)
3. Wait until **sending** capability is verified
4. Set on Railway **api**:

```text
PASSWORD_RESET_EMAIL_FROM=noreply@mail.yourdomain.com
PASSWORD_RESET_EMAIL_FROM_NAME=Spark Dating
```

5. Redeploy **api**

Or from this repo:

```bash
cd backend
node scripts/configure-bird-email.js
node scripts/configure-bird-email.js --register mail.yourdomain.com
```

## Test inbox (devflow@tokmail.net)

Only useful **after** Path A (invite that address to Bird Team) or Path B (verified domain).

| Variable | Purpose |
|----------|---------|
| `TEMPMAIL_EMAIL` | `devflow@tokmail.net` |
| `TEMPMAIL_ACCESS_TOKEN` | Reopen the same inbox on any device |
| `TEMPMAIL_INBOX_URL` | [Open inbox on Tmailor](https://tmailor.com/reuse-temp-mail-address) |

### How to test password reset

1. Sign up with an email that Bird is allowed to send to (workspace member **or** any address after domain verify)
2. Forgot password → **Send reset code**
3. If Bird rejects the recipient, the app shows a clear error (not a fake success)
4. Open inbox / spam and enter the 6-digit code

## Railway

Keep:

```text
EMAIL_PROVIDER=bird
BIRD_API_KEY=bk_eu1_...
BIRD_WORKSPACE_ID=ws_01kwy5m1she1m8a1jm5g7dmqf8
PASSWORD_RESET_EMAIL_FROM=onboarding@messagebird.dev
PASSWORD_RESET_EMAIL_FROM_NAME=Spark Dating
```

After domain verification, change only `PASSWORD_RESET_EMAIL_FROM` to your verified address and redeploy.
