# Flutterwave mobile money (subscriptions)

Use Flutterwave to send the **MTN/Airtel mobile money PIN popup** when users subscribe.

> **Note:** [Direct transfers](https://developer.flutterwave.com/reference/direct_transfers_post) are for **payouts** (sending money out).  
> To **collect** subscription payments we use the [Orchestrator direct charge](https://developer.flutterwave.com/reference/orchestration_direct_charge_post) with `mobile_money`.

## Authentication (OAuth 2.0)

Flutterwave v4 uses **OAuth 2.0 client credentials**, not a static secret key on every request. The backend automatically:

1. Requests an `access_token` from the token endpoint
2. Caches it for ~10 minutes
3. Refreshes when less than 60 seconds remain

Token endpoint: `https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`

Docs: [Authentication](https://developer.flutterwave.com/docs/authentication)

## How it works

1. User picks a plan and enters their Uganda mobile money number (`+2567...`).
2. Backend obtains OAuth token, then follows Flutterwave's [mobile money flow](https://developer.flutterwave.com/docs/mobile-money):
   - **Create or find customer** — [`GET /customers`](https://developer.flutterwave.com/reference/customers_list) / `POST /customers`
   - **Create mobile money payment method** — `POST /payment-methods`
   - **Create charge** — `POST /charges`
3. Flutterwave sends a **push notification / payment prompt** to that phone.
4. User enters their PIN and taps **I've approved** in the app.
5. Backend verifies via `GET /charges/{chargeId}` before activating the subscription.

## Setup (sandbox)

1. Sign up at [Flutterwave Dashboard](https://dashboard.flutterwave.com).
2. Get your **Client ID** and **Client Secret** (test/sandbox credentials).
3. Add to `backend/.env`:

```text
FLUTTERWAVE_CLIENT_ID=your_client_id
FLUTTERWAVE_CLIENT_SECRET=your_client_secret
FLUTTERWAVE_SANDBOX=true
FLUTTERWAVE_CURRENCY=UGX
MOBILE_MONEY_SIMULATE=false
```

4. Restart the backend.
5. Subscribe in the app with an MTN or Airtel Uganda number.

## Production

```text
FLUTTERWAVE_CLIENT_ID=your_live_client_id
FLUTTERWAVE_CLIENT_SECRET=your_live_client_secret
FLUTTERWAVE_SANDBOX=false
FLUTTERWAVE_CURRENCY=UGX
```

Use **production** client credentials for live mode. Add the same variables to Railway **api** and redeploy.

## Network detection

Uganda numbers are auto-detected:

| Prefix | Network |
|--------|---------|
| 77, 78, 76, 39, 79 | MTN |
| 70, 75, 74 | Airtel |

Override with `FLUTTERWAVE_DEFAULT_NETWORK=MTN` if needed.

## API routes (Spark Dating)

| Route | Purpose |
|-------|---------|
| `GET /api/subscriptions/flutterwave/customers?page=1&size=10` | List Flutterwave customers (debug) |
| `POST /api/subscriptions/mobile-money/prompt` | Start mobile money charge |
| `POST /api/subscriptions/mobile-money/verify` | Verify Flutterwave or MTN payment |

## Alternatives

- **MTN MoMo direct:** `MOBILE_MONEY_SETUP.md` + `npm run momo:setup`
- **Africa's Talking checkout:** `AFRICAS_TALKING_PAYMENT_PRODUCT_NAME` in `.env`

Provider priority when `MOBILE_MONEY_SIMULATE=false`:

1. Flutterwave (if `FLUTTERWAVE_CLIENT_ID` + `FLUTTERWAVE_CLIENT_SECRET` set)
2. MTN MoMo (if `MTN_MOMO_*` set)
3. Africa's Talking checkout

Docs: [Mobile money collection](https://developer.flutterwave.com/docs/mobile-money) · [Orchestrator charge API](https://developer.flutterwave.com/reference/orchestration_direct_charge_post)
