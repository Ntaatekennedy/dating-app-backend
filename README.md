# Dating App Backend

Node.js REST API for the Spark Dating Flutter app. Uses MySQL and mirrors the `dating app.sql` schema.

## Setup

### 1. MySQL database

Run the combined SQL file in MySQL Workbench:

```
dating app.sql
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

## Demo login

- Email: `demo@dating.app`
- Password: `password123`

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
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

## Flutter app

The Flutter app now reads backend settings from `lib/config/app_config.dart`.

- `useApiBackend = true` enables the API repository
- `apiBaseUrl` defaults to Railway for Android
- You can override at build/run time with:

```bash
--dart-define=API_BASE_URL=https://your-domain.up.railway.app
```
