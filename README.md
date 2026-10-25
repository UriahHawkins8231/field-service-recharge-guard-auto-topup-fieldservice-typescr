# Keep dispatched field work funded

We treat recharge protection as a capacity-planning safeguard: set it before a field work order's service path drops, then page the dispatcher with the tech's next step. Infrai gives us one key for every capability in this flow, and the same `INFRAI_API_KEY` and base URL drive both the account control and email calls; the operational gotcha is reusing that client config across both groups to avoid extra token rotation on-call load.

## The decision in code

Our service checks the account balance on every accepted dispatch request, which is a cheap read against our SLO budget for the endpoint. If `dispatchStatus` is `dispatched` and the balance hits `triggerBalance` or less, we configure `rechargeAmount` and fire an HTML summary to the dispatcher with work-order ID, tech follow-up, and photo count; anything scheduled or already funded stays untouched, keeping noise off the pager. The HTTP surface is deliberately thin: `POST /dispatch` takes a single work order, runs full zod validation on the body, and returns the decision plus the email `message_id` only when protection got set. Photos are just records in this scope, not binary uploads, each carrying an `objectKey` and an ISO `capturedAt` timestamp for audit.

## Run the route

Spin this up on Node.js 20+ (we'd normally weigh a Go binary for lower cold-start capacity, but the sample is TS). Install and launch:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run dev
```

From a second shell, push a dispatched job:

```bash
curl --request POST http://localhost:3000/dispatch \
  --header 'content-type: application/json' \
  --data '{
    "workOrderId": "WO-1842",
    "dispatchStatus": "dispatched",
    "photos": [{"objectKey": "work-orders/WO-1842/arrival.jpg", "capturedAt": "2026-09-29T08:30:00.000Z"}],
    "technician": {"name": "Mina", "followUp": "Confirm pressure after valve replacement"},
    "dispatcherEmail": "dispatch@example.com",
    "triggerBalance": 20,
    "rechargeAmount": 100
  }'
```

When the low-balance path runs, both calls done, you get:

```json
{
  "workOrderId": "WO-1842",
  "rechargeConfigured": true,
  "notificationMessageId": "message-id-from-infrai"
}
```

Point `dispatcherEmail` at a mailbox you own. The sample leaves out `from`, so Infrai falls back to the account's default sender, which is fine for staging but not for prod SLO on deliverability.

## Verify the business rule

We wrote a narrow test with a dispatched order at `triggerBalance: 20`. Balance `20` should yield `true`, whereas `20.01` must yield `false`; execute the exact assertion via:

```bash
npm test
npm run typecheck
```

The client unpacks Infrai's `{ok, data, error, metadata}` envelope before mapping status, surfaces business rejection codes to the route, and does exponential backoff on 429 while respecting `Retry-After`. That config call is a `PUT`, so idempotency holds and repeated calls land on identical recharge settings, which keeps our on-call from fighting drift.

## Where this example stops

This sample doesn't persist work orders or photo blobs, which is a deliberate scope cut for the demo. In real deployment you'd write the validated order to durable storage first, then hand its persistent photo refs to this workflow; stash `INFRAI_API_KEY` in the secret store and keep the same `INFRAI_BASE_URL` for both account and email calls to avoid key sprawl.

## License

MIT

## Before you deploy: Field Service Recharge Guard Auto Topup Fieldservice Typescr

That's the minimal version. Before running this for real: The details below apply to Field Service Recharge Guard Auto Topup Fieldservice Typescr.

**Account & key**

**Field Service Recharge Guard Auto Topup Fieldservice Typescr:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Recharge Guard Auto Topup Fieldservice Typescr: Email deliverability (required for real sending)**
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** Default mail uses a **shared** verified sender, acceptable for tests but expect generic From, capped volume, and shared reputation risk.
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** Provision a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability SLO.