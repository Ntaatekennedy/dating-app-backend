# Dating App Backend

Node.js REST API for the Spark Dating Flutter app (v1.0.24). Uses MySQL and mirrors the `dating_app.sql` schema.

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

- Email: `demo@dating.app`
- Password: `password123`

Phone OTP routes (`/send-otp`, `/verify-otp-login`) remain available for optional SMS login.

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account with `email`, `password`, and profile fields |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/forgot-password` | Request password reset code by email |
| POST | `/api/auth/reset-password` | Reset password with email + code |
| POST | `/api/auth/ping` | Update current user's `last_active_at` (online status) |
| POST | `/api/auth/send-otp` | Send login OTP via SMS (optional) |
| POST | `/api/auth/verify-otp-login` | Verify OTP and sign in (optional) |
| GET | `/api/auth/me` | Current user + profile |
| GET | `/api/discover` | Discover profiles (includes `lastActiveAt`) |
| POST | `/api/discover/swipe` | Swipe on a user |
| GET | `/api/likes/received` | People who liked you (not yet mutual) |
| GET | `/api/matches` | List mutual matches (includes `otherLastActiveAt`) |
| GET | `/api/matches/:id/messages` | Chat messages |
| GET | `/api/matches/:id/live?after=<iso>` | Live feed: new messages + typing state |
| POST | `/api/matches/:id/messages` | Send message |
| POST | `/api/matches/:id/typing` | Set typing indicator (`{ "isTyping": true/false }`) |
| POST | `/api/matches/:id/read` | Mark messages read |
| PUT | `/api/profile/profile` | Update profile |
| PUT | `/api/profile/preferences` | Update preferences |
| GET | `/api/profile/interests` | All interests (public) |
| PUT | `/api/profile/interests` | Set user interests |
| PUT | `/api/profile/phone` | Update own phone |
| GET | `/api/profile/photos/:userId` | List user photos |
| POST | `/api/profile/photo` | Upload or replace primary photo |
| POST | `/api/profile/photos` | Add gallery photo (max 3) |
| DELETE | `/api/profile/photos/:photoId` | Delete a photo (including last one) |
| GET | `/api/subscriptions/status` | Chat/phone access status |
| POST | `/api/subscriptions/purchase` | Buy subscription |
| GET | `/api/users/:id/public` | Public profile (includes `lastActiveAt`) |
| GET | `/api/users/:id/phone` | Phone number (always masked) |
| POST | `/api/users/:id/block` | Block user |
| POST | `/api/users/:id/report` | Report user |

Send `Authorization: Bearer <token>` on protected routes.

## Environment variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for auth tokens |
| `OTP_TTL_MINUTES` | OTP expiry (default `5`) |
| `SMS_PROVIDER` | `bird` (default), `twilio`, or `console` |
| `BIRD_WORKSPACE_ID` | Bird workspace ID |
| `BIRD_API_KEY` | Bird access key |
| `BIRD_NAVIGATOR_ID` | Bird navigator ID (recommended) |
| `BIRD_CHANNEL_ID` | Bird SMS channel ID (alternative to navigator) |

## Flutter app

The Flutter app reads backend settings from `lib/config/app_config.dart`.

- `useApiBackend = true` enables the API repository
- `apiBaseUrl` defaults to Railway for Android and web
- Override at build/run time:

```bash
--dart-define=API_BASE_URL=https://your-domain.up.railway.app
```
