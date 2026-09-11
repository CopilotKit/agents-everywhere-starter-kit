# WhatsApp: identity, phone approval, and a saved named request

[Template](../../../templates/whatsapp.md) · [All walkthroughs](../README.md) · [Account setup](../../../using-sponsor-tools.md#whatsapp-identity-and-phone-approval)

This app uses **OpenAI Agents SDK + CopilotKit Channels + Auth0**, with direct Meta WhatsApp delivery. Auth0 and Meta setup screenshots below come from real development accounts. The Meta message, Guardian approval, saved receipt, and restart journey remain pending; account configuration alone does not prove the phone flow.

![Auth0 setup screenshot walkthrough; live WhatsApp phone approval remains pending](images/auth0-setup-walkthrough.gif)

This 20-second GIF steps through the five setup screenshots below. It is not a recording of a WhatsApp conversation.

## 1. Prepare the Auth0 application and device

Follow the [Auth0 application and user setup](../../../using-sponsor-tools.md#auth0-application-and-user). Confirm CIBA entitlement/enabling first. Configure a confidential Regular Web Application, authorization code + CIBA grants, the API audience and `create:requests` permission, and the public callback URL. Enable **Guardian push only**, disable email fallback, and enroll the test user's Guardian device.

**Captured September 11, 2026:** the following screens are from an actual development tenant. They document configuration; no Guardian challenge has yet been approved.

Create a **Regular Web Application** for the server’s confidential login and CIBA client.

![Auth0 application creation with Regular Web Application selected](images/01-auth0-application.jpg)

Create the API permission, enable RBAC, and grant this application user-delegated access to `create:requests`. Confirm **1 / 1 permissions granted** in the app’s row.

![Auth0 application has one user-delegated API permission](images/02-auth0-app-permission.jpg)

Add the same API permission to a requester role. Assign that role to the application user after their first login; a dashboard administrator is a separate identity.

![Auth0 requester role contains create requests](images/03-auth0-requester-role.jpg)

Enable **Push Notification using Auth0 Guardian** and select the **Auth0 Guardian** app. The phone illustration on this settings page is Auth0’s preview, not a captured approval. Configure the application’s CIBA notification channel as Guardian push only, then require MFA for the demo user’s login.

![Auth0 Guardian push factor enabled with the Guardian app selected](images/04-auth0-guardian-factor.jpg)

In **Advanced Settings → Grant Types**, enable **Authorization Code** and **Client Initiated Backchannel Authentication (CIBA)** and save. The saved settings below show both grants, Guardian push enabled, and email disabled. The demo tenant also has its MFA policy set to **Always** so the first login requests enrollment.

![Saved authorization-code and CIBA grants with Guardian push enabled and email disabled](images/05-auth0-ciba-grants.jpg)

**Capture pending:** actual application-user role assignment and device enrollment. Exclude client secrets, tokens, enrollment QR codes, and private user data.

## 2. Configure Meta and the public origin

Follow [Meta and Channels setup](../../../using-sponsor-tools.md#whatsapp-transport-setup-meta--copilotkit-channels). The following onboarding screens were captured on September 11, 2026.

![Meta setup screenshot walkthrough; recipient and live delivery remain pending](images/meta-setup-walkthrough.gif)

This 12-second GIF walks through the three Meta screenshots below. It shows app creation and the provisioned test number; no phone message has been sent in this capture.

1. Sign in to Meta for Developers and open **My Apps → Create App**. Enter an app name and your work contact email. In this run, Meta rejected a name containing its “WhatsApp” trademark, so the demo uses **Agents Everywhere Pocket**.
2. Select **Connect with customers through WhatsApp**. Choose a business portfolio you control, or create one using your public business name. Review the app details and select **Create app**. This development demo uses the new CopilotKit portfolio; its business verification remains incomplete.

![Meta creation overview with the WhatsApp use case and development business portfolio](images/06-meta-app-overview.jpg)

3. On the new dashboard, select **Customize the Connect with customers through WhatsApp use case**. The app is still unpublished.

![Created Meta app dashboard with the WhatsApp customization entry point](images/07-meta-app-dashboard.jpg)

4. Continue with the selected portfolio, then open **Basic setup → Step 1. Try it out**. Meta provisions a test phone number and displays its **Phone Number ID** and WhatsApp Business account ID. The screenshot below was taken before generating an access token.

![Meta test phone number provisioned, with no access token generated in the capture](images/08-meta-test-number.jpg)

5. Select **Generate token** and keep the result private as `WHATSAPP_ACCESS_TOKEN`. Copy the **Phone Number ID**, rather than the displayed phone number, into `WHATSAPP_PHONE_NUMBER_ID`. Open **App settings → Basic → Show** to retrieve the app secret for `WHATSAPP_APP_SECRET`; Meta may require password re-entry. Never include access tokens or app secrets in screenshots or commits.
6. Add your own WhatsApp number as a test recipient and complete its verification. This step is still pending in the recorded demo. A provisioned sender number alone does not establish that messages can reach your phone.

Start the app and set Meta’s callback to `https://YOUR-PUBLIC-ORIGIN/webhooks/whatsapp`. Supply the matching verify token and subscribe to messages. Use the same public origin for the Auth0 callback. Keep the tunnel running; expose port 3003 and keep the SDK listener on port 3004 private.

**Capture pending:** verified Meta recipient, successful webhook verification, and messages subscription. Exclude access tokens, application secrets, verify tokens, and unrelated phone numbers.

## 3. Install and start the app

```bash
npm ci --prefix apps/whatsapp
cp apps/whatsapp/.env.example apps/whatsapp/.env
npm run typecheck --prefix apps/whatsapp
npm test --prefix apps/whatsapp
npm start --prefix apps/whatsapp
```

Edit `apps/whatsapp/.env` privately using the [complete environment reference](../../../apps/whatsapp/.env.example). This app listens on port 3003 and has its own install/lockfile. Use one process with persistent disk. Check the [app README](../../../apps/whatsapp/README.md) for health and operational details.

**Capture pending:** healthy app startup and tunnel routing. Local tests exercise adapters; they do not establish real signed Meta delivery.

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
