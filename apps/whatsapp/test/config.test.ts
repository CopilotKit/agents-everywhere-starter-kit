import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.js';

test('configuration rejects missing credentials and insecure public callback URLs', () => {
  assert.throws(() => readConfig({}), /OPENAI_API_KEY/);
  assert.throws(() => readConfig({
    OPENAI_API_KEY: 'test', PUBLIC_BASE_URL: 'http://insecure.example', AUTH0_ISSUER_BASE_URL: 'https://tenant.auth0.com',
    AUTH0_CLIENT_ID: 'client', AUTH0_CLIENT_SECRET: 'secret', AUTH0_AUDIENCE: 'https://demo.example',
    TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`, TWILIO_AUTH_TOKEN: 'test', TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
  }), /PUBLIC_BASE_URL/);
});
