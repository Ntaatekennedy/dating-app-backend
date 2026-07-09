# Email setup (password reset)

Password reset codes are sent by **Bird Email** to the user's registered email address. The code is never shown in the app UI.

## Production / local config

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `bird` |
| `BIRD_WORKSPACE_ID` | `ws_01kwy5m1she1m8a1jm5g7dmqf8` |
| `BIRD_API_KEY` | Your `bk_eu1_...` key from [bird.com/dashboard](https://bird.com/dashboard) |
| `PASSWORD_RESET_EMAIL_FROM` | `devflow@tokmail.net` |
| `PASSWORD_RESET_EMAIL_FROM_NAME` | `Spark Dating` |

Docs: [Bird — Sending email](https://bird.com/en-us/docs/guides/email/sending-email/)

## Test inbox (devflow@tokmail.net)

Use the reusable Tmailor inbox from `tempmail.json` (copied from your Downloads export):

| Variable | Purpose |
|----------|---------|
| `TEMPMAIL_EMAIL` | `devflow@tokmail.net` |
| `TEMPMAIL_ACCESS_TOKEN` | Reopen the same inbox on any device |
| `TEMPMAIL_INBOX_URL` | One-click link to read incoming messages |

### How to test password reset

1. Sign up or use an account registered with **`devflow@tokmail.net`**
2. In the app, go to **Forgot password** → enter `devflow@tokmail.net` → **Send reset code**
3. Open your inbox: [reuse temp mail address](https://tmailor.com/reuse-temp-mail-address) and paste the access token from `TEMPMAIL_ACCESS_TOKEN`, or open `TEMPMAIL_INBOX_URL` directly
4. Copy the 6-digit code from the email and enter it in the app

Messages stay in the inbox for about 24 hours. The address itself stays reusable as long as you keep the access token.

## Railway

On the **api** service, set the same `EMAIL_PROVIDER`, `BIRD_*`, and `PASSWORD_RESET_EMAIL_*` variables, then redeploy.
