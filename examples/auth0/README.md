# Auth0: authorize an incident follow-up

Give an agent service permission to take one concrete action: create a follow-up
for an incident. The demo first receives **401** without credentials, then obtains
an Auth0 access token and creates a real local record with **201**. The API verifies
the token's signature, issuer, audience, expiration and `create:followups` scope
using Auth0's official Express middleware.

This is **machine-to-machine authorization**: the identity is your application.
It does not establish a person's consent or implement CIBA/Guardian approval. It
is an optional standalone recipe; root startup and the existing Auth0 consent
extension are unchanged. Use this when your hackathon agent needs a protected API.

## Get access

1. Create or open an [Auth0 tenant](https://auth0.com/signup).
2. In **Applications → APIs**, create an API named `Hackathon follow-ups`, with
   identifier `https://agents-everywhere.example/api` and signing algorithm **RS256**.
   The identifier is an audience string; you do not need to host that URL.
3. In the API's **Permissions**, add `create:followups`.
4. Create a **Machine to Machine** application, authorize it for this API, and
   grant `create:followups`. Copy its domain, client ID and client secret from
   **Settings**. Use the same domain for the client and API.

These steps follow Auth0's [Node API quickstart](https://auth0.com/docs/quickstart/backend/nodejs)
and [client credentials guide](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-credentials-flow/call-your-api-using-the-client-credentials-flow).

## Configure and run

Requires Node.js 22 or newer. From the repository root:

```sh
npm ci --prefix examples/auth0
npm test --prefix examples/auth0
```

The tests need no credentials or external services. They generate ephemeral RSA
keys, serve a local OIDC/JWKS fixture, and exercise the real JWT middleware.

For the live demo, export the following environment variables into your terminals
using your secret manager. Keep the client secret out of shell history and source
control. The server needs only the first two variables; the client needs all four.

| Variable | Value |
| --- | --- |
| `AUTH0_DOMAIN` | Your bare tenant or custom hostname, e.g. `your-tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | `https://agents-everywhere.example/api` (exact API identifier) |
| `AUTH0_CLIENT_ID` | Your machine-to-machine application's client ID |
| `AUTH0_CLIENT_SECRET` | That application's secret |

If you use the repository's ignored `.env`, Node can load it explicitly without
putting values into commands. Add the four variables there locally, then run:

```sh
# Terminal 1, from the repository root
node --env-file=.env examples/auth0/server.mjs

# Terminal 2, from the repository root
node --env-file=.env examples/auth0/client.mjs
```

If the variables are already exported, use `npm start --prefix examples/auth0`
and `npm run demo --prefix examples/auth0` instead. The server binds only to
`127.0.0.1:3101`; the client always calls that local endpoint. Tokens remain in
memory, and the client prints the resulting record, never the token or secret.

## Expected result

```text
Unauthenticated action: denied (401). Authorized action: created (201).
{
  "id": "<generated UUID>",
  "incidentId": "INC-1042",
  "title": "Investigate retry spike after the deploy",
  "status": "open",
  "createdBy": "<your client ID>@clients",
  "createdAt": "<current timestamp>"
}
```

Records exist in the server's in-memory map until it stops. This example does not
write to your team's issue tracker. Running the client again creates another record.

A **401** means the access token is missing or invalid: check domain, audience,
RS256 signing and expiration. **403** means the token lacks `create:followups`:
check the M2M API grant and rerun the client to obtain a fresh token. If the token
request itself fails, check the API authorization and application credentials.

## Make it yours

- Edit `action` in [client.mjs](./client.mjs) to use context from your incident or agent tool.
- Replace `records.set` in [server.mjs](./server.mjs) with a persistent task store or
  issue tracker call. Keep token verification and scope checks ahead of that side effect.
- Return the record to the originating conversation so the participant can see
  the protected action's result where they started.
- For actions requiring a person's approval, add a separate human authorization
  flow using [Auth0's asynchronous authorization guide](https://auth0.com/ai/docs/get-started/asynchronous-authorization).
  A machine token alone does not provide that approval.

Offline coverage includes valid, missing, malformed, expired, wrong-audience,
wrong-issuer, incorrectly signed and insufficient-scope tokens, plus invalid
request bodies. A live Auth0 tenant flow is a separate account-dependent check.
