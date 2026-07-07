# Dating App Backend

Node.js REST API for the Spark Dating Flutter app. Uses MySQL and mirrors the `dating_app.sql` schema.

## Setup

### 1. MySQL database

Run the combined SQL file in MySQL Workbench:

```
database/dating_app.sql
```

### 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your MySQL credentials and a secure `JWT_SECRET`.

### 3. Install and run

Requires [Node.js](https://nodejs.org/) (LTS). Then:

```bash
npm install
npm run dev
```

API base URL: `http://localhost:3000`

## Demo sign-in

**Phone OTP (sign in only):**
- Phone: `+256700100001`
- `POST /api/auth/send-otp` sends an SMS to the phone (Twilio required)
- `POST /api/auth/verify-otp-login` with `{ "phone", "code" }` completes sign in

**Sign up:** no OTP — `POST /api/auth/register` with `phone` and profile fields.

**Legacy email login:**
- Email: `demo@dating.app`
- Password: `password123`

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send login OTP via SMS (`purpose` must be `login`) |
| POST | `/api/auth/verify-otp-login` | Verify OTP and sign in |
| POST | `/api/auth/register` | Create account with `phone` (no OTP) |
| POST | `/api/auth/login` | Legacy email/password login |
| GET | `/api/auth/me` | Current user + profile |
| GET | `/api/discover` | Discover profiles |
| POST | `/api/discover/swipe` | Swipe on a user |
| GET | `/api/matches` | List matches |
| GET | `/api/matches/:id/messages` | Chat messages |
| POST | `/api/matches/:id/messages` | Send message (subscription) |
| POST | `/api/matches/:id/read` | Mark messages read |
| PUT | `/api/profile/profile` | Update profile |
| PUT | `/api/profile/preferences` | Update preferences |
| GET | `/api/profile/interests` | All interests |
| PUT | `/api/profile/interests` | Set user interests |
| PUT | `/api/profile/phone` | Update own phone |
| POST | `/api/profile/photo` | Upload primary photo |
| GET | `/api/subscriptions/status` | Chat/phone access status |
| POST | `/api/subscriptions/purchase` | Buy subscription |
| GET | `/api/users/:id/public` | Public profile |
| GET | `/api/users/:id/phone` | Phone number (subscription) |
| POST | `/api/users/:id/block` | Block user |
| POST | `/api/users/:id/report` | Report user |

Send `Authorization: Bearer <token>` on protected routes.

## Environment variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for auth tokens |
| `OTP_TTL_MINUTES` | OTP expiry (default `5`) |
| `SMS_PROVIDER` | `twilio` (default), or `console` for local logs only |
| `TWILIO_ACCOUNT_SID` | From [Twilio Console](https://console.twilio.com/) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender number (E.164) |

## Flutter app

The Flutter app reads backend settings from `lib/config/app_config.dart`.

- `useApiBackend = true` enables the API repository
- `apiBaseUrl` defaults to Railway for Android and web
- Override at build/run time:

```bash
--dart-define=API_BASE_URL=https://your-domain.up.railway.app
```
