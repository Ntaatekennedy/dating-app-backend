# Email setup (password reset)

Password reset codes are sent to the user's registered email. The code is never shown in the app UI.

## Current provider: Resend (free)

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Your `re_...` key from [resend.com/api-keys](https://resend.com/api-keys) |
| `PASSWORD_RESET_EMAIL_FROM` | `onboarding@resend.dev` |
| `PASSWORD_RESET_EMAIL_FROM_NAME` | `Spark Dating` |

### Important Resend limit (no domain)

With `onboarding@resend.dev`, Resend **only delivers to the email on your Resend account**.

1. Sign up / check your email at [resend.com](https://resend.com)
2. Use **that same email** as the Spark account for Forgot password
3. Check inbox + spam for the 6-digit code

To email **any** user later: add a domain at [resend.com/domains](https://resend.com/domains), then set:

```text
PASSWORD_RESET_EMAIL_FROM=noreply@mail.yourdomain.com
```

Docs: [Resend — Send email](https://resend.com/docs/send-with-nodejs) · [403 onboarding domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

## Optional: Bird

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `bird` |
| `BIRD_API_KEY` | `bk_eu1_...` |
| `PASSWORD_RESET_EMAIL_FROM` | `onboarding@messagebird.dev` |

Bird’s onboarding sender only reaches **verified Bird workspace members**. Same idea as Resend: invite your email under Settings → Team, or verify a domain.

## Optional: Termii

```text
EMAIL_PROVIDER=termii
TERMII_API_KEY=
TERMII_EMAIL_CONFIG_ID=
```

## Railway

On **api** set:

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
PASSWORD_RESET_EMAIL_FROM=onboarding@resend.dev
PASSWORD_RESET_EMAIL_FROM_NAME=Spark Dating
```

Then redeploy **api**.

## Test inbox (devflow@tokmail.net)

Only works after you can send to that address (verified domain, or that address is your Resend/Bird account email).

| Variable | Purpose |
|----------|---------|
| `TEMPMAIL_EMAIL` | `devflow@tokmail.net` |
| `TEMPMAIL_ACCESS_TOKEN` | Reopen inbox on Tmailor |
| `TEMPMAIL_INBOX_URL` | [tmailor.com/reuse-temp-mail-address](https://tmailor.com/reuse-temp-mail-address) |
