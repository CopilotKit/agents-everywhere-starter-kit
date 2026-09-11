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

test('the planner defaults to direct OpenAI and supports MODEL before the legacy OPENAI_MODEL', () => {
  const config = readConfig({ ...env, OPENAI_API_KEY: ' direct-key ' });
  assert.equal(config.modelProvider, 'openai');
  assert.equal(config.modelApiKey, 'direct-key');
  assert.equal(config.model, 'gpt-4.1-mini');
  assert.equal(readConfig({ ...env, OPENAI_MODEL: 'gpt-4.1' }).model, 'gpt-4.1');
  for (const model of ['gpt-4.1', 'openai/gpt-4.1', 'openai:gpt-4.1']) {
    assert.equal(readConfig({ ...env, MODEL_PROVIDER: 'openai', MODEL: ` ${model} `, OPENAI_MODEL: 'legacy-unused' }).model, 'gpt-4.1');
  }
});

test('OpenRouter needs only its own key and preserves publisher slugs and routing suffixes', () => {
  const router = { ...env, MODEL_PROVIDER: 'openrouter', OPENAI_API_KEY: undefined, OPENROUTER_API_KEY: ' router-key ' };
  const config = readConfig(router);
  assert.equal(config.modelProvider, 'openrouter');
  assert.equal(config.modelApiKey, 'router-key');
  assert.equal(config.model, 'openai/gpt-4.1-mini');
  for (const model of ['anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-4.1']) {
    assert.equal(readConfig({ ...router, MODEL: model }).model, model);
  }
  assert.equal(readConfig({ ...router, MODEL: 'gpt-4.1' }).model, 'openai/gpt-4.1');
  assert.equal(readConfig({ ...router, OPENAI_MODEL: 'gpt-4.1' }).model, 'openai/gpt-4.1');
  assert.equal(readConfig({ ...router, OPENAI_API_KEY: 'unused-direct', MODEL: 'gpt-4.1' }).modelApiKey, 'router-key');
});

test('a missing or blank selected key cannot fall back to the other provider', () => {
  for (const key of [undefined, '', ' \t ']) {
    assert.throws(() => readConfig({ ...env, MODEL_PROVIDER: 'openai', OPENAI_API_KEY: key, OPENROUTER_API_KEY: 'router-key' }), /OPENAI_API_KEY/);
    assert.throws(() => readConfig({ ...env, MODEL_PROVIDER: 'openrouter', OPENROUTER_API_KEY: key }), /OPENROUTER_API_KEY/);
  }
});

test('invalid provider and model settings fail with field names, without echoing values', () => {
  assert.throws(() => readConfig({ ...env, MODEL_PROVIDER: 'private-unknown-provider' }), (error: Error) => {
    assert.match(error.message, /MODEL_PROVIDER/);
    assert.ok(!error.message.includes('private-unknown-provider'));
    return true;
  });
  for (const model of ['anthropic/claude-sonnet-4', 'anthropic:claude-sonnet-4', '', '  ', 'openai/', 'openai:', 'gpt 4.1', 'https://private.example/model']) {
    assert.throws(() => readConfig({ ...env, MODEL: model }), /MODEL/);
  }
  for (const model of ['', ' ', 'openai/', '/gpt-4.1', 'openai/gpt-4.1/extra', 'https://private.example/model']) {
    assert.throws(() => readConfig({ ...env, MODEL_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'router-key', MODEL: model }), /MODEL/);
  }
});
