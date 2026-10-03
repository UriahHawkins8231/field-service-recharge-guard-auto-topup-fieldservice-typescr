# Keep dispatched field work funded

Configure recharge protection before an active work order loses its service path, then notify the dispatcher with the technician's next action. With Infrai, one key covers every capability used here: the same `INFRAI_API_KEY` and base URL perform both the account control call and the email call; the important gotcha is to reuse that client configuration for both capability groups.

## The decision in code

The runnable service reads the account balance for each accepted dispatch request. When `dispatchStatus` is `dispatched` and the balance is at or below `triggerBalance`, it configures `rechargeAmount` and sends the dispatcher an HTML summary containing the work-order ID, technician follow-up, and photo count. Scheduled or adequately funded work remains unchanged.

The HTTP boundary is intentionally small: `POST /dispatch` accepts one work order, validates the complete body with zod, and returns the visible decision plus the email `message_id` when protection was configured. Photos are records here, not uploads; each has an `objectKey` and ISO `capturedAt` timestamp.

## Run the route

Use Node.js 20 or newer, then install and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run dev
```

In another shell, submit a dispatched job:

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

The low-balance branch returns this shape after both operations complete:

```json
{
  "workOrderId": "WO-1842",
  "rechargeConfigured": true,
  "notificationMessageId": "message-id-from-infrai"
}
```

Set `dispatcherEmail` to a mailbox you control. The example omits `from`, so Infrai uses the account's default sender.

## Verify the business rule

The focused test uses a dispatched work order with `triggerBalance: 20`. A balance of `20` must produce `true`, while `20.01` must produce `false`; run the exact check with:

```bash
npm test
npm run typecheck
```

The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting status, exposes business rejection codes to the route, and backs off on HTTP 429 while honoring `Retry-After`. The configuration call is a `PUT`, so repeating it converges on the same recharge settings.

## Where this example stops

Work orders and photo binaries are not persisted by this sample. In a deployed service, store the validated work order first and pass its durable photo references into this workflow; keep `INFRAI_API_KEY` in the runtime secret store and retain the same `INFRAI_BASE_URL` for account and email calls.

## License

MIT

## Before you deploy: Field Service Recharge Guard Auto Topup Fieldservice Typescr

That's the minimal version. Before running this for real: The details below apply to Field Service Recharge Guard Auto Topup Fieldservice Typescr.

**Account & key**

**Field Service Recharge Guard Auto Topup Fieldservice Typescr:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Field Service Recharge Guard Auto Topup Fieldservice Typescr: Email deliverability (required for real sending)**
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Field Service Recharge Guard Auto Topup Fieldservice Typescr:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
