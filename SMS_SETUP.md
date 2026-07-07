# SMS setup (sign-in OTP)

Sign-in sends a 6-digit OTP by SMS. Sign-up does **not** use SMS.

## Recommended: Africa's Talking (+256 Uganda)

1. Create a free account at [africastalking.com](https://africastalking.com)
2. Open **SMS** → **Create app** (use **Sandbox** for testing)
3. Copy:
   - **Username** (e.g. `sandbox`)
   - **API Key** (from Settings → API Key)
4. In **Sandbox**, add your test phone numbers under **Phone numbers**

### Railway (production)

In [Railway](https://railway.com/dashboard) → project `spark-dating-backend` → service **api** → **Variables**:

| Variable | Value |
|----------|--------|
| `SMS_PROVIDER` | `africas_talking` |
| `OTP_TTL_MINUTES` | `5` |
| `AFRICAS_TALKING_USERNAME` | your username |
| `AFRICAS_TALKING_API_KEY` | your API key |
| `AFRICAS_TALKING_SENDER_ID` | `Spark` |

Redeploy **api** after saving.

### Local dev

In `backend/.env`:

```env
SMS_PROVIDER=africas_talking
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_API_KEY=your_key
AFRICAS_TALKING_SENDER_ID=Spark
```

Or use `SMS_PROVIDER=console` to log OTP in the terminal (no real SMS).

## Alternative: Twilio

1. Sign up at [twilio.com](https://www.twilio.com)
2. Get **Account SID**, **Auth Token**, and a **Phone Number**
3. On Railway set:

| Variable | Value |
|----------|--------|
| `SMS_PROVIDER` | `twilio` |
| `TWILIO_ACCOUNT_SID` | … |
| `TWILIO_AUTH_TOKEN` | … |
| `TWILIO_PHONE_NUMBER` | `+1…` |

## CLI (Railway)

```bash
cd backend
railway service link api
railway variable set SMS_PROVIDER=africas_talking OTP_TTL_MINUTES=5 AFRICAS_TALKING_SENDER_ID=Spark
railway variable set AFRICAS_TALKING_USERNAME=your_username
railway variable set AFRICAS_TALKING_API_KEY=your_api_key --stdin
# paste key, then Ctrl+Z Enter on Windows
```

## Test

```bash
curl -X POST https://api-production-4f51.up.railway.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"+256700100001\",\"purpose\":\"login\"}"
```

Use a phone number that exists in your database and is allowed in the SMS sandbox.
