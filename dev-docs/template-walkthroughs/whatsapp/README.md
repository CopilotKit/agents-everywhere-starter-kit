# WhatsApp: identity, phone approval, and a saved named request

[Template](../../../templates/whatsapp.md) · [All walkthroughs](../README.md) · [Account setup](../../../using-sponsor-tools.md#whatsapp-identity-and-phone-approval)

This independent app uses **OpenAI Agents SDK + Auth0**, with Twilio WhatsApp delivery. All live screenshots below are **pending**: no Twilio/Auth0/Guardian account journey has been captured for this template. The steps describe what to do and what each future screenshot must prove; no mock success images are supplied.

## 1. Prepare the Auth0 application and device

Follow the [Auth0 application and user setup](../../../using-sponsor-tools.md#auth0-application-and-user). Confirm CIBA entitlement/enabling first. Configure a confidential Regular Web Application, authorization code + CIBA grants, the API audience and `create:requests` permission, and the public callback URL. Enable **Guardian push only**, disable email fallback, and enroll the test user's Guardian device.

**Capture pending:** application grant types, push-only CIBA configuration, API permission, and enrolled factor status. Exclude client secrets, tokens, QR enrollment secrets, and private user data.

## 2. Join the Twilio Sandbox and configure the public origin

Join the Twilio WhatsApp Sandbox from the phone that will send test messages. Configure the signed inbound webhook and app's public HTTPS origin using [Twilio and app setup](../../../using-sponsor-tools.md#whatsapp-transport-setup-twilio). Use the same public origin for the Auth0 callback. Keep the tunnel running.

**Capture pending:** Sandbox joined confirmation and webhook URL configuration, excluding Twilio credentials and unrelated phone numbers.

## 3. Install and start the independent app

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm run typecheck --prefix apps/whatsapp
npm test --prefix apps/whatsapp
npm start --prefix apps/whatsapp
```

Edit `apps/whatsapp/.env` privately using the [complete environment reference](../../../apps/whatsapp/.env.example). This app listens on port 3003 and has its own install/lockfile. Use one process with persistent disk. Check the [app README](../../../apps/whatsapp/README.md) for health and operational details.

**Capture pending:** healthy app startup and tunnel routing. Local tests exercise adapters; they do not establish real signed Twilio delivery.

## 4. Link the original WhatsApp sender

Text `hello`. Open the returned link and select **Continue with Auth0**. Sign in, then send the browser's `LINK <code>` from the original WhatsApp conversation. Check the bot recognizes the linked display name.

**Capture pending:** inbound greeting, Auth0 sign-in entry, the confirmation-code screen, and successful sender-bound linking. Hide the short-lived linking code in public screenshots. Opening a forwarded link alone must not bind a different sender.

## 5. Propose the exact named request

Text `Save a request called team-lunch`. Read the proposed label and request ID. Open the Guardian push and check that it describes the same exact action. Approve it on the enrolled phone.

**Capture pending:** WhatsApp proposal and matching Guardian approval screen. An approval screen alone is not execution evidence.

## 6. Verify the saved receipt and restart

Check the WhatsApp receipt and exact local named-request record. Restart the app, then text `STATUS`. Verify it reports the same saved request. The demo saves a local record; it does not book a lunch or schedule a reminder.

**Capture pending:** actual saved receipt, a sanitized record inspection, and status after restart with the same request ID.

## 7. Demonstrate denial and expiry

After the app's cooldown, propose a different label and deny its Guardian request. Propose another and let the approval expire. Inspect status and the local store: neither may produce a saved record. Retry an inbound delivery to check duplicate handling without creating another request.

**Capture pending:** denied/expired statuses and absence of their records. These are required live checks before describing the complete WhatsApp journey as working.
