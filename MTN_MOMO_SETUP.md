# MTN MoMo direct payments

Use MTN MoMo **Collections** to send a real Mobile Money PIN popup to the user's phone — no PesaPal page.

## Sandbox setup (free)

1. Sign up at [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
2. **Products → Collections** → subscribe → copy **Primary Key**
3. In `backend/.env`:

```text
MTN_MOMO_SUBSCRIPTION_KEY=your_primary_key
```

4. Run:

```bash
cd backend
npm run momo:setup
```

5. Copy the printed `MTN_MOMO_API_USER` and `MTN_MOMO_API_KEY` into `.env`
6. Force MTN when PesaPal is also configured:

```text
MOBILE_MONEY_PROVIDER=mtn
MTN_MOMO_ENV=sandbox
MTN_MOMO_TARGET_ENV=sandbox
MTN_MOMO_CURRENCY=EUR
MTN_MOMO_USE_PREAPPROVAL=false
MOBILE_MONEY_SIMULATE=false
```

7. Restart backend and subscribe with an MTN test number (`+2567...`)

Sandbox charges **EUR 1** (not UGX plan prices). Override with `MTN_MOMO_SANDBOX_AMOUNT=1`.

## Payment modes

| `MTN_MOMO_USE_PREAPPROVAL` | API | Use case |
|----------------------------|-----|----------|
| `false` (recommended) | RequestToPay | One-time payment popup |
| `true` | PreApproval | Recurring mandate (returns pre-approval record) |

Pre-approval status uses the schema: `preApprovalId`, `status`, `externalId`, `maxDebitAmount`, etc.

## Production (Uganda)

```text
MTN_MOMO_ENV=production
MTN_MOMO_TARGET_ENV=mtnuganda
MTN_MOMO_CURRENCY=UGX
MOBILE_MONEY_PROVIDER=mtn
BASE_URL=https://your-public-api.example.com
MTN_MOMO_CALLBACK_URL=https://your-public-api.example.com/api/subscriptions/mtn/callback
```

Requires production Collections credentials from MTN Uganda. Phone must be **MTN Uganda** (`+2567...`).

## App flow

1. User picks **Mobile money** and enters MTN number
2. Backend calls MTN RequestToPay (or PreApproval)
3. PIN popup appears on the phone
4. App polls every ~600ms; backend verifies + activates subscription in one call
5. Green **Premium** tag on profile

## Troubleshooting

- **PesaPal page opens instead of popup:** Set `MOBILE_MONEY_PROVIDER=mtn` (PesaPal wins by default when both are configured).
- **"MTN MoMo credentials are invalid":** Re-run `npm run momo:setup` or check `MTN_MOMO_API_USER` / `MTN_MOMO_API_KEY`.
- **Payment stays pending:** Enter PIN on the phone; sandbox can take a few seconds after approval.
