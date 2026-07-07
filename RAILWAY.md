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
   | `SMS_PROVIDER` | `africas_talking` or `twilio` |
   | `OTP_TTL_MINUTES` | `5` |
   | `AFRICAS_TALKING_USERNAME` | Your AT app username (sandbox or live) |
   | `AFRICAS_TALKING_API_KEY` | Your AT API key |
   | `AFRICAS_TALKING_SENDER_ID` | `Spark` (or your approved sender ID) |

   **Twilio alternative:** set `SMS_PROVIDER=twilio` and add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

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
