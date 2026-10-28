# PesaPal mobile money (Uganda)

Your **consumer_key** / **consumer_secret** are **PesaPal** credentials (from [PesaPal demo keys](https://developer.pesapal.com/api3-demo-keys.txt)), **not** Flutterwave.

PesaPal sends users to a payment page where they choose **Mobile Money (MTN/Airtel)** and complete payment on their phone.

## Setup (Uganda sandbox)

Already configured in `.env` if you used the Ugandan merchant demo keys:

```text
PESAPAL_CONSUMER_KEY=TDpigBOOhs+zAl8cwH2Fl82jJGyD8xev
PESAPAL_CONSUMER_SECRET=1KpqkfsMaihIcOlhnBo/gBZ5smw=
PESAPAL_SANDBOX=true
PESAPAL_CURRENCY=UGX
PESAPAL_COUNTRY_CODE=UG
MOBILE_MONEY_SIMULATE=false
```

## Register IPN (required once)

```bash
cd backend
npm run pesapal:test
```

Copy the printed `PESAPAL_IPN_ID` into `.env`, then restart the backend.

## Test auth

```bash
npm run pesapal:test
```

## Flow in the app

1. User picks mobile money and enters phone (`+2567...` or `07...`)
2. Backend calls [PesaPal SubmitOrderRequest](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest)
3. App shows **Open payment page** → user picks Mobile Money on PesaPal
4. App polls automatically and unlocks chat when payment completes (no manual confirm button)

## Production keys

- [Authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication)
- [Submit order](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest)
- [Transaction status](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus)

## Other country demo keys

The Kenyan, Tanzanian, etc. keys from the same PesaPal demo file work the same way — set `PESAPAL_CURRENCY` and `PESAPAL_COUNTRY_CODE` for that country.

## Flutterwave (optional)

Flutterwave uses **Client ID** + **Client Secret** from [Flutterwave Dashboard](https://dashboard.flutterwave.com) — different from PesaPal `consumer_key`.
