# Auth0 protected API example

This independent example shows a missing credential denied with `401`, followed by an Auth0-authorized call that creates a local follow-up with `201`. It checks JWT signature, issuer, audience, expiration, and `create:followups` scope. Records remain in memory until the server stops.

**[Authentication, configuration, and the first working call →](../../using-sponsor-tools.md#standalone-protected-api-call)**

This example demonstrates machine-to-machine authorization. The server checks the service identity and scope before creating a record.

## Source and verification

- [server.mjs](server.mjs): token/scope validation and local record creation.
- [client.mjs](client.mjs): unauthenticated request followed by an authorized request.
- [test.mjs](test.mjs): local OIDC/JWKS fixture and real JWT middleware checks.

```bash
npm ci --prefix examples/auth0
npm test --prefix examples/auth0
```

Run from the repository root. Tests need no credentials. Live access requires the Auth0 configuration in the consolidated guide.
