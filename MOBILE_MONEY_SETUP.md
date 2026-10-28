# Mobile money subscriptions

Paid chat unlock uses mobile money through **PesaPal** by default (Uganda MTN/Airtel).

## Required env vars

```text
SUBSCRIPTIONS_ENABLED=true
MOBILE_MONEY_SIMULATE=false
PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
PESAPAL_SANDBOX=false
PESAPAL_CURRENCY=UGX
PESAPAL_COUNTRY_CODE=UG
PESAPAL_IPN_ID=from npm run pesapal:test
BASE_URL=http://localhost:3000
```

## Setup

```bash
cd backend
npm run pesapal:test    # verify auth + register IPN
npm start
```

## App flow

1. User picks **Mobile money** and enters phone (`+2567...`)
2. Backend starts PesaPal checkout → app opens payment page
3. User pays with MTN/Airtel on PesaPal
4. App polls every ~600ms; backend verifies + activates subscription in one call
5. Green **Premium** tag appears on profile

## Alternatives

| Provider | Docs |
|----------|------|
| PesaPal (default) | [PESAPAL_SETUP.md](PESAPAL_SETUP.md) |
| Flutterwave direct popup | [FLUTTERWAVE_SETUP.md](FLUTTERWAVE_SETUP.md) |
| MTN MoMo API (direct popup) | [MTN_MOMO_SETUP.md](MTN_MOMO_SETUP.md) — `npm run momo:setup` |

Provider priority when multiple are configured: **PesaPal → Flutterwave → MTN MoMo → Africa's Talking**.

Set `MOBILE_MONEY_PROVIDER=mtn` to use MTN direct popup even when PesaPal keys are present.

## Production deploy (APK uses Railway API)

The Android APK calls `https://api-production-4f51.up.railway.app`. Payment keys must be on **Railway**, not only in local `.env`.

```bash
cd backend
npm run pesapal:register-production-ipn   # once — registers IPN for production URL
npm run railway:sync-payments             # pushes PesaPal vars from .env to Railway
```

Required Railway variables:

```text
BASE_URL=https://api-production-4f51.up.railway.app
PESAPAL_CONSUMER_KEY=...
PESAPAL_CONSUMER_SECRET=...
PESAPAL_SANDBOX=false
PESAPAL_CURRENCY=UGX
PESAPAL_COUNTRY_CODE=UG
PESAPAL_IPN_ID=...   # from register-production-ipn
MOBILE_MONEY_SIMULATE=false
SUBSCRIPTIONS_ENABLED=true
```

After sync, reinstall the APK and test mobile money — PesaPal opens **in-app**, then chat unlocks automatically.

## Troubleshooting

- **Paid but no green tag:** Hot restart app (`R` in Flutter terminal). IPN also activates subscription server-side.
- **Cannot GET callback:** Backend must be running; callback route is `/api/subscriptions/pesapal/callback`.
- **Production deploy:** Set `BASE_URL` to your public API URL so PesaPal IPN/callback reach your server.
