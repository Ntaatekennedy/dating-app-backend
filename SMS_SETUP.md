# SMS setup with Bird (sign-in OTP)

Sign-in sends a 6-digit OTP by SMS. Sign-up does **not** use SMS.

## 1. Bird dashboard setup

Open your Bird workspace: [bird.com/dashboard](https://bird.com/dashboard)

Your workspace ID (from your URL):
`ws_01kwy5m1she1m8a1jm5g7dmqf8`

### API key

1. Go to **Settings** → **Security** → **Access Keys**
2. Create a key with **Application Developer** role (SMS send permission)
3. Copy the access key (shown once) — EU keys start with `bk_eu1_`

The server auto-uses `https://eu1.platform.bird.com/v1` for `bk_eu1_` keys.

Docs: [Bird authentication](https://bird.com/en-gb/docs/guides/authentication) · [Regions](https://bird.com/en-it/docs/api/regions)

### SMS channel or navigator

You need an SMS-capable number installed as a channel in Bird.

1. Set up **Programmable SMS** in your Bird workspace
2. Copy either:
   - **Channel ID** (SMS channel), or
   - **Navigator ID** (recommended — Bird picks the best SMS route)

Docs: [Send an SMS message](https://docs.bird.com/api/quickstarts/send-an-sms-message)

## 2. Railway (production API)

[Railway](https://railway.com/dashboard) → **spark-dating-backend** → **api** → **Variables**:

| Variable | Value |
|----------|--------|
| `SMS_PROVIDER` | `bird` |
| `OTP_TTL_MINUTES` | `5` |
| `BIRD_WORKSPACE_ID` | `ws_01kwy5m1she1m8a1jm5g7dmqf8` |
| `BIRD_API_KEY` | Your Bird access key |
| `BIRD_NAVIGATOR_ID` | Navigator ID (recommended), **or** |
| `BIRD_CHANNEL_ID` | SMS channel ID |

Redeploy **api** after saving.

## 3. Local backend

Edit `backend/.env`:

```env
SMS_PROVIDER=bird
OTP_TTL_MINUTES=5
BIRD_WORKSPACE_ID=ws_01kwy5m1she1m8a1jm5g7dmqf8
BIRD_API_KEY=your_access_key
BIRD_NAVIGATOR_ID=your_navigator_id
# or BIRD_CHANNEL_ID=your_channel_id
```

Restart: `npm run dev`

## 4. Test sign-in

1. Use a phone number registered in the app
2. Tap **Send verification code**
3. Check SMS on the phone
4. Enter code → **Sign In**

If Bird is not fully configured, the server falls back to showing a test code in the app.

## Alternative providers

- **Twilio:** set `SMS_PROVIDER=twilio` + `TWILIO_*` vars
- **Console (dev):** set `SMS_PROVIDER=console` — OTP logged on server only
