# Deploy to Railway

Deploy from the [Railway dashboard](https://railway.com/dashboard) or the CLI.

## Option A — Dashboard (recommended)

1. Open **[railway.com/dashboard](https://railway.com/dashboard)** and sign in.
2. **New Project** → **Deploy from GitHub repo** → select **`Ntaatekennedy/dating-app-backend`**.
3. In the project, click **+ New** → **Database** → **MySQL**.
4. Open your **API service** → **Variables** → **Add references** from the MySQL service:
   - `MYSQLHOST` → `DB_HOST`
   - `MYSQLPORT` → `DB_PORT`
   - `MYSQLUSER` → `DB_USER`
   - `MYSQLPASSWORD` → `DB_PASSWORD`
   - `MYSQLDATABASE` → `DB_NAME`
5. Add these variables on the API service:

   | Variable | Value |
   |----------|--------|
   | `JWT_SECRET` | A long random string |
   | `NODE_ENV` | `production` |

   `BASE_URL` is optional — Railway’s public domain is used automatically.

6. **Settings** → **Networking** → **Generate Domain** (copy the `*.up.railway.app` URL).
7. **MySQL** → **Connect** → run `database/dating_app.sql` from the Flutter project (or import via MySQL client).
8. Redeploy if needed. Test: `https://YOUR-DOMAIN.up.railway.app/health`

## Option B — CLI

```bash
cd backend
railway login
railway init
railway add --database mysql
railway up
railway domain
```

Set `JWT_SECRET` in the Railway dashboard under **Variables**.

## Flutter app

Update `lib/config/app_config.dart`:

```dart
static const String _androidLanBaseUrl = 'https://YOUR-DOMAIN.up.railway.app';
```

Phone and PC need internet (not local Wi‑Fi only).
