# Email setup (password reset)

Password reset codes are sent by **Bird Email** to the user's registered email address. The code is never shown in the app UI.

## Production / local config

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `bird` |
| `BIRD_WORKSPACE_ID` | `ws_01kwy5m1she1m8a1jm5g7dmqf8` |
| `BIRD_API_KEY` | Your `bk_eu1_...` key from [bird.com/dashboard](https://bird.com/dashboard) |
| `PASSWORD_RESET_EMAIL_FROM` | `onboarding@messagebird.dev` |
| `PASSWORD_RESET_EMAIL_FROM_NAME` | `Spark Dating` |

**Important:** `devflow@tokmail.net` is your **test inbox** (receive only). Do not use it as the Bird sender — Bird requires a verified domain or the shared `onboarding@messagebird.dev` address.

Docs: [Bird — Sending email](https://bird.com/en-us/docs/guides/email/sending-email/)

## Test inbox (devflow@tokmail.net)

Use the reusable Tmailor inbox from `tempmail.json`:

| Variable | Purpose |
|----------|---------|
| `TEMPMAIL_EMAIL` | `devflow@tokmail.net` |
| `TEMPMAIL_ACCESS_TOKEN` | Reopen the same inbox on any device |
| `TEMPMAIL_INBOX_URL` | [Open inbox on Tmailor](https://tmailor.com/reuse-temp-mail-address) |

### How to test password reset

1. Sign up or use an account registered with **`devflow@tokmail.net`** (or your Gmail — codes are sent there too)
2. In the app, go to **Forgot password** → enter your email → **Send reset code**
3. Open your inbox:
   - **Gmail users:** check inbox and spam
   - **Temp mail:** open [tmailor.com/reuse-temp-mail-address](https://tmailor.com/reuse-temp-mail-address) and paste your access token
4. Copy the 6-digit code from the email and enter it in the app

## Railway

On the **api** service, set `PASSWORD_RESET_EMAIL_FROM=onboarding@messagebird.dev` (not `devflow@tokmail.net`), then redeploy.
