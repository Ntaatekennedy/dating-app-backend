# SMS setup with Twilio (sign-in OTP)

Sign-in sends a 6-digit OTP by SMS. Sign-up does **not** use SMS.

## 1. Get credentials from Twilio Console

Open **[console.twilio.com](https://console.twilio.com/)** and sign in (or create a free account).

### Account SID & Auth Token

1. On the **Account Dashboard** home page, find **Account Info**
2. Copy **Account SID** (starts with `AC…`)
3. Copy **Auth Token** (click **Show** to reveal it)

### Phone number

1. Go to **Phone Numbers** → **Manage** → **Active numbers**
   - Or: [console.twilio.com/us1/develop/phone-numbers/manage/incoming](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. If you have no number, click **Buy a number** (trial accounts get a free number)
3. Copy the number in E.164 format (e.g. `+15551234567`)

### Trial account note

On a **free trial**, SMS only works to **verified** phone numbers:

1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Add and verify the phone numbers you want to test (e.g. your `+256…` number)

## 2. Configure Railway (production API)

[Railway](https://railway.com/dashboard) → project **spark-dating-backend** → service **api** → **Variables**:

| Variable | Where to get it |
|----------|-----------------|
| `SMS_PROVIDER` | `twilio` |
| `OTP_TTL_MINUTES` | `5` |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_PHONE_NUMBER` | Your Twilio number, e.g. `+15551234567` |

Save variables, then redeploy **api** (or wait for auto-deploy).

## 3. Configure local backend

Edit `backend/.env`:

```env
SMS_PROVIDER=twilio
OTP_TTL_MINUTES=5
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

Restart the server: `npm run dev`

## 4. Railway CLI (optional)

```bash
cd backend
railway service link api
railway variable set SMS_PROVIDER=twilio OTP_TTL_MINUTES=5
railway variable set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
railway variable set TWILIO_AUTH_TOKEN=your_auth_token
railway variable set TWILIO_PHONE_NUMBER=+15551234567
railway up --service api
```

## 5. Test sign-in

1. Use a phone number that exists in your app database (seed: `+256700100001`)
2. On trial accounts, that number must be **verified** in Twilio Console
3. In the app: enter phone → **Send verification code** → check SMS on the phone
4. Enter the code → **Sign In**

If Twilio is not configured, the server falls back to showing a test code in the app (for development only).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SMS service is not configured` | Set all three `TWILIO_*` variables on Railway |
| SMS not received (trial) | Verify the destination number in Twilio Console |
| `Could not send verification code` | Check Twilio logs under **Monitor** → **Logs** → **Errors** |
| Uganda `+256` numbers | Ensure your Twilio account supports SMS to Uganda; trial may need verified numbers |

## Alternative: console mode (no SMS)

For local testing without Twilio:

```env
SMS_PROVIDER=console
```

OTP is logged in the server terminal and returned to the app as a test code.
