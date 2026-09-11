import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createWhatsAppChannel } from '../src/channels.js';
import { readConfig } from '../src/config.js';
import { listen, stop } from './support.js';

test('actual Meta rendering keeps underscore login URLs clickable and LINK codes unchanged', async () => {
  const graph = express();
  graph.use(express.json());
  let rendered = '';
  graph.post('/v23.0/123/messages', (req, res) => {
    assert.equal(req.body.type, 'text');
    rendered = req.body.text.body;
    res.json({ messages: [{ id: 'wamid.literalurl' }] });
  });
  const token = 'AAAA__B__CCCC';
  graph.get('/link/:token', (req, res) => {
    assert.equal(req.params.token, token, 'the clicked URL resolves to the original login token');
    res.send('usable login route');
  });
  const provider = await listen(graph);
  try {
    const config = readConfig({
      OPENAI_API_KEY: 'test', PUBLIC_BASE_URL: 'https://demo.example', AUTH0_ISSUER_BASE_URL: 'https://tenant.auth0.com',
      AUTH0_CLIENT_ID: 'test', AUTH0_CLIENT_SECRET: 'test', AUTH0_AUDIENCE: 'test',
      WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_APP_SECRET: 'test',
      WHATSAPP_VERIFY_TOKEN: 'test', INTELLIGENCE_API_KEY: 'cpk-1_test',
    });
    const { sendReply } = createWhatsAppChannel(config, () => {}, { graphBaseUrl: provider.url });
    const link = `${provider.url}/link/${token}`;
    const code = 'LINK ABCDEF1234567890';
    await sendReply('15550000001', `Sign in: ${link}\nThen send ${code}`);
    const displayedLink = rendered.match(/http:\/\/[^\s]+/)?.[0];
    assert.ok(displayedLink);
    assert.equal(decodeURI(displayedLink), link, 'the rendered URL must retain its original destination');
    assert.ok(!displayedLink.includes('`'), 'the URL must remain outside code formatting');
    assert.ok(rendered.includes(code));
    assert.equal(await (await fetch(displayedLink)).text(), 'usable login route');
  } finally { await stop(provider.server); }
});
