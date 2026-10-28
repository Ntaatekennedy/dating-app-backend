# Deploy to Railway

Deploy from the [Railway dashboard](https://railway.com/dashboard) or the CLI.

## Current deployed setup

- **Railway project:** `spark-dating-backend`
- **GitHub repo:** `Ntaatekennedy/dating-app-backend`
- **API service:** `api`
- **MySQL service:** `MySQL`
- **Public API URL:** `https://api-production-4f51.up.railway.app`

## Option A — Dashboard (recommended)

1. Open **[railway.com/dashboard](https://railway.com/dashboard)** and sign in.
2. Open project **`spark-dating-backend`**.
3. Ensure both services exist:
   - `api` (Node.js backend)
   - `MySQL` (database)
4. Open **api** → **Variables** and keep these references:
   - `DB_HOST=${{MySQL.MYSQLHOST}}`
   - `DB_PORT=${{MySQL.MYSQLPORT}}`
   - `DB_USER=${{MySQL.MYSQLUSER}}`
   - `DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}`
   - `DB_NAME=${{MySQL.MYSQLDATABASE}}`
   - `MYSQL_URL=${{MySQL.MYSQL_URL}}`
5. Add these variables on **api**:

   | Variable | Value |
   |----------|--------|
   | `JWT_SECRET` | A long random string |
   | `NODE_ENV` | `production` |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY` | Your `re_...` key from [resend.com/onboarding](https://resend.com/onboarding) |
   | `PASSWORD_RESET_EMAIL_FROM` | `onboarding@resend.dev` (or `noreply@your-verified-domain` after DNS) |
   | `PASSWORD_RESET_EMAIL_FROM_NAME` | `Spark Dating` |
   | `OTP_TTL_MINUTES` | `5` |
   | `SUBSCRIPTIONS_ENABLED` | `true` |
   | `SMS_PROVIDER` | `africas_talking` |
   | `AFRICAS_TALKING_USERNAME` | Your AT username |
   | `AFRICAS_TALKING_API_KEY` | Your AT API key |
   | `AFRICAS_TALKING_PAYMENT_PRODUCT_NAME` | Uganda mobile money product from AT dashboard |
   | `AFRICAS_TALKING_CURRENCY_CODE` | `UGX` |

   See [EMAIL_SETUP.md](EMAIL_SETUP.md) for password reset email, [MOBILE_MONEY_SETUP.md](MOBILE_MONEY_SETUP.md) for subscription payments, and [SMS_SETUP.md](SMS_SETUP.md) for SMS OTP.

   `BASE_URL` is optional — Railway’s public domain is used automatically.

6. **api** → **Settings** → **Networking** should include:
   - `https://api-production-4f51.up.railway.app`
7. Redeploy **api** if needed.
8. Test: `https://api-production-4f51.up.railway.app/health`

## Option B — CLI

```bash
cd backend
railway login
railway link
railway service link api
railway up --service api
railway domain --service api
```

Set `JWT_SECRET` in the Railway dashboard under **Variables**.

## Flutter app

Update `lib/config/app_config.dart`:

```dart
static const String _androidLanBaseUrl = 'https://api-production-4f51.up.railway.app';
```

Phone and PC need internet (not local Wi‑Fi only).
