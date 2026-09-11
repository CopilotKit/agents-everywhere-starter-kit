import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { type Config } from '../src/service.js';
import express from 'express';
import { createWhatsAppApp, availableWebhookPort } from '../src/runtime.js';
import { listen, stop, intelligenceGateway } from './support.js';

test('public WhatsApp route forwards the Meta verification challenge', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'meta-transport-'));
  const config: Config = {
    publicBaseUrl: 'https://demo.example', issuer: 'https://tenant.auth0.com/', clientId: 'test', clientSecret: 'test', audience: 'test',
    whatsappAccessToken: 'test', whatsappPhoneNumberId: '123', whatsappAppSecret: 'test', whatsappVerifyToken: 'verify-me',
    whatsappWebhookPort: 3004, whatsappApiVersion: 'v23.0', channelName: 'whatsapp-demo', intelligenceApiKey: 'cpk-1_test',
    model: 'gpt-4.1-mini', dataFile: join(directory, 'state.json'), port: 3003,
  };
  const provider = await listen(express());
  const gateway = intelligenceGateway(provider.server, provider.url);
  const service = await createWhatsAppApp({ ...config, whatsappWebhookPort: 0 }, { intelligenceUrls: gateway.urls, graphBaseUrl: provider.url, planner: async () => ({ reply: 'hi', requestLabel: null }) });
  const server = createServer(service.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '12345');
    const origin = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${origin}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`)).status, 403);
    assert.equal((await fetch(`${origin}/webhooks/whatsapp`, { method: 'PUT' })).status, 405);
    assert.equal((await fetch(`${origin}/webhooks/whatsapp`, { method: 'POST', body: 'x'.repeat(65537) })).status, 413);
    assert.equal((await fetch(`${origin}/webhooks/whatsapp`, { method: 'POST', body: '{invalid json' })).status, 400);
    assert.equal((await fetch(`${origin}/enqueue`, { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await fetch(`${origin}/webhook`, { method: 'POST', body: '{}' })).status, 404);
    await assert.rejects(availableWebhookPort(service.config.whatsappWebhookPort), /LISTENER_PORT_UNAVAILABLE/);

  } finally {
    await service.stop();
    await gateway.close();
    await stop(provider.server);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
