import { pathToFileURL } from 'node:url';
import { configuration } from './server.mjs';

export async function runDemo(config, request = fetch) {
  const endpoint = 'http://127.0.0.1:3101/followups';
  const action = { incidentId: 'INC-1042', title: 'Investigate retry spike after the deploy' };
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action), redirect: 'error' };
  const denied = await request(endpoint, { ...options, signal: AbortSignal.timeout(10000) });
  if (denied.status !== 401) throw new Error('Expected the API to reject an unauthenticated action with HTTP 401.');
  await denied.arrayBuffer();
  const tokenResponse = await request(`${config.issuer}oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: config.clientId,
      client_secret: config.clientSecret, audience: config.audience }),
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!tokenResponse.ok) throw new Error(`Auth0 token request failed (HTTP ${tokenResponse.status}); check your M2M API grant and credentials.`);
  const token = await tokenResponse.json();
  if (typeof token.access_token !== 'string' || !token.access_token ||
      token.token_type?.toLowerCase() !== 'bearer') throw new Error('Auth0 did not return a Bearer access token.');
  const response = await request(endpoint, { ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10000) });
  if (response.status !== 201) throw new Error(`Follow-up failed (HTTP ${response.status}); check audience and create:followups permission.`);
  return response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const record = await runDemo(configuration(process.env, true));
    console.log('Unauthenticated action: denied (401). Authorized action: created (201).');
    console.log(JSON.stringify(record, null, 2));
  } catch (error) {
    // Deliberately omit stacks, response bodies and credentials from diagnostics.
    console.error((error instanceof TypeError || error instanceof SyntaxError) ? 'Request failed; check configuration and that the local API is running.' : error.message);
    process.exitCode = 1;
  }
}
