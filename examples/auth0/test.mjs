import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp, configuration } from './server.mjs';
import { runDemo } from './client.mjs';

const audience = 'https://agents-everywhere.example/api';
const records = new Map();
let issuer, api, jwksServer, apiServer, privateKey;
before(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const key = { ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
  jwksServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url.includes('.well-known')
      ? { issuer, jwks_uri: `${issuer}jwks`, id_token_signing_alg_values_supported: ['RS256'] }
      : { keys: [key] }));
  }).listen(0, '127.0.0.1');
  await once(jwksServer, 'listening');
  issuer = `http://127.0.0.1:${jwksServer.address().port}/`;
  apiServer = createApp({ issuer, audience, records })
    .listen(0, '127.0.0.1');
  await once(apiServer, 'listening');
  api = `http://127.0.0.1:${apiServer.address().port}/followups`;
});
after(async () => {
  await Promise.all([apiServer, jwksServer].filter(Boolean).map(server =>
    new Promise(resolve => server.close(resolve))));
});
async function token(overrides = {}, key = privateKey) {
  return new SignJWT({ scope: 'create:followups', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.iss ?? issuer).setAudience(overrides.aud ?? audience)
    .setSubject('hackathon-client@clients').setIssuedAt()
    .setExpirationTime(overrides.exp ?? '5m').sign(key);
}
async function post(bearer, body = { incidentId: 'INC-1042', title: 'Investigate retry spike' }) {
  return fetch(api, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  }, body: JSON.stringify(body) });
}

test('an authorized service creates an actual in-memory follow-up', async () => {
  const response = await post(await token());
  assert.equal(response.status, 201);
  const record = await response.json();
  assert.equal(record.incidentId, 'INC-1042');
  assert.equal(record.status, 'open');
  assert.equal(record.createdBy, 'hackathon-client@clients');
  assert.deepEqual(records.get(record.id), record);
});
for (const [name, makeToken, expected] of [
  ['missing bearer', async () => undefined, 401],
  ['malformed JWT', async () => 'invalid.jwt', 401],
  ['expired token', () => token({ exp: Math.floor(Date.now() / 1000) - 120 }), 401],
  ['wrong audience', () => token({ aud: 'another-api' }), 401],
  ['wrong issuer', () => token({ iss: 'https://another-issuer.example/' }), 401],
  ['wrong signature', async () => token({}, (await generateKeyPair('RS256')).privateKey), 401],
  ['missing permission', () => token({ scope: 'read:followups' }), 403],
]) {
  test(`${name} cannot create a follow-up`, async () => {
    const count = records.size;
    const response = await post(await makeToken());
    assert.equal(response.status, expected);
    assert.equal(records.size, count);
  });
}
for (const body of [null, {}, { incidentId: 'INC-1', title: ' ' },
  { incidentId: 42, title: 'Investigate' }, { incidentId: 'INC-1', title: 'x'.repeat(201) }]) {
  test(`rejects invalid input ${JSON.stringify(body).slice(0, 70)}`, async () => {
    const count = records.size;
    assert.equal((await post(await token(), body)).status, 400);
    assert.equal(records.size, count);
  });
}

for (const [name, body, headers, expected, message] of [
  ['malformed JSON', '{broken', {}, 400, 'Invalid JSON body.'],
  ['oversized body', JSON.stringify({ title: 'x'.repeat(5000) }), {}, 413,
    'Request body is too large.'],
  ['unsupported charset', JSON.stringify({ incidentId: 'INC-1', title: 'Investigate' }),
    { 'Content-Type': 'application/json; charset=iso-8859-1' }, 415,
    'Unsupported request charset or content encoding.'],
  ['unsupported content encoding', JSON.stringify({ incidentId: 'INC-1', title: 'Investigate' }),
    { 'Content-Encoding': 'unsupported' }, 415,
    'Unsupported request charset or content encoding.'],
]) {
  test(`${name} returns a sanitized client error and creates no records`, async () => {
    const count = records.size;
    const response = await fetch(api, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${await token()}`, ...headers,
    }, body });
    assert.equal(response.status, expected);
    assert.deepEqual(await response.json(), { error: message });
    assert.equal(records.size, count);
  });
}

test('client obtains a token only after proving the API rejects anonymous actions', async () => {
  const calls = [];
  const record = { id: 'followup-1', status: 'open' };
  const request = async (url, options) => {
    calls.push({ url, options });
    return [new Response(null, { status: 401 }),
      Response.json({ access_token: 'fixture-token', token_type: 'Bearer' }),
      Response.json(record, { status: 201 })][calls.length - 1];
  };
  assert.deepEqual(await runDemo({ issuer: 'https://tenant.example/', audience,
    clientId: 'fixture-client', clientSecret: 'fixture-secret' }, request), record);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].url, 'https://tenant.example/oauth/token');
  assert.equal(JSON.parse(calls[1].options.body).grant_type, 'client_credentials');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer fixture-token');
  assert.equal(calls[2].options.redirect, 'error');
});

test('client stops when token issuance fails without exposing response details', async () => {
  let calls = 0;
  await assert.rejects(runDemo({ issuer: 'https://tenant.example/', audience,
    clientId: 'fixture-client', clientSecret: 'fixture-secret' }, async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 401 }) :
      new Response('sensitive response details', { status: 403 });
  }), { message: 'Auth0 token request failed (HTTP 403); check your M2M API grant and credentials.' });
  assert.equal(calls, 2);
});

test('configuration requires credentials and a bare domain', () => {
  assert.throws(() => configuration({}), /Set AUTH0_DOMAIN/);
  assert.throws(() => configuration({ AUTH0_DOMAIN: 'https:\/\/tenant.example',
    AUTH0_AUDIENCE: audience }), /bare hostname/);
  assert.throws(() => configuration({ AUTH0_DOMAIN: 'tenant.example',
    AUTH0_AUDIENCE: audience }, true), /Set AUTH0_CLIENT_ID/);
});
