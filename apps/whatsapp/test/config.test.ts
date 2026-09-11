import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.js';

const env = {
  OPENAI_API_KEY: 'test', PUBLIC_BASE_URL: 'https://demo.example', AUTH0_ISSUER_BASE_URL: 'https://tenant.auth0.com',
  AUTH0_CLIENT_ID: 'client', AUTH0_CLIENT_SECRET: 'secret', AUTH0_AUDIENCE: 'https://demo.example',
  WHATSAPP_ACCESS_TOKEN: 'meta-test', WHATSAPP_PHONE_NUMBER_ID: '123456789', WHATSAPP_APP_SECRET: 'app-secret',
  WHATSAPP_VERIFY_TOKEN: 'verify-token', WHATSAPP_CHANNEL_NAME: 'whatsapp-demo', INTELLIGENCE_API_KEY: 'cpk-1_test',
};
test('configuration rejects missing credentials and insecure public callback URLs', () => {
  assert.throws(() => readConfig({}), /OPENAI_API_KEY/);
  assert.throws(() => readConfig({ ...env, PUBLIC_BASE_URL: 'http://insecure.example' }), /PUBLIC_BASE_URL/);
});
test('Meta and Intelligence configuration works without Twilio and keeps one public origin', () => {
  const config = readConfig(env);
  assert.equal(config.port, 3003);
  assert.equal(config.whatsappWebhookPort, 3004);
  assert.equal(config.whatsappPhoneNumberId, '123456789');
  assert.equal(config.channelName, 'whatsapp-demo');
});
test('configuration catches runtime key/name mistakes and listener collisions before starting', () => {
  assert.throws(() => readConfig({ ...env, INTELLIGENCE_API_KEY: 'not-a-project-key' }), /INTELLIGENCE_API_KEY/);
  assert.throws(() => readConfig({ ...env, WHATSAPP_CHANNEL_NAME: 'Bad_Name' }), /WHATSAPP_CHANNEL_NAME/);
  assert.throws(() => readConfig({ ...env, WHATSAPP_CHANNEL_NAME: 'channels' }), /WHATSAPP_CHANNEL_NAME/);
  assert.throws(() => readConfig({ ...env, PORT: '3004' }), /must be different/);
});

test('startup diagnostics identify invalid environment fields without echoing credentials', async (context) => {
  const { reportError } = await import('../src/diagnostics.js');
  const logger = context.mock.method(console, 'error', () => {});
  try { readConfig({ ...env, INTELLIGENCE_API_KEY: 'private-invalid-credential' }); }
  catch (error) { reportError('Startup failed', error); }
  const output = logger.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
  assert.match(output, /INVALID_CONFIGURATION/);
  assert.match(output, /INTELLIGENCE_API_KEY/);
  assert.ok(!output.includes('private-invalid-credential'));
});
