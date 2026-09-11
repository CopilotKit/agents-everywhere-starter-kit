import assert from 'node:assert/strict';
import type { IncomingHttpHeaders } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createPlanner, type PlannerInput } from '../src/agent.js';
import { reportError } from '../src/diagnostics.js';
import { listen, stop } from './support.js';

const input: PlannerInput = {
  identity: { sub: 'auth0|alice', name: 'Alice' }, text: 'Save it',
  history: [{ role: 'user', content: 'The name is team-lunch' }, { role: 'assistant', content: 'Ready to propose it.' }],
};
const proposal = { reply: 'Please approve on your phone.', requestLabel: 'team-lunch' };
type RequestBody = {
  model?: string; tools?: unknown[]; messages?: { role: string; content: string | { type: string; text: string }[] }[];
  provider?: unknown; response_format?: { type: string; json_schema: Record<string, unknown> };
  text?: { format: Record<string, unknown> };
};
async function plannerFixture(options: { content?: string; status?: number } = {}) {
  const requests: { path: string; authorization?: string; headers: IncomingHttpHeaders; body: RequestBody }[] = [];
  const endpoints: string[] = [];
  const api = express(); api.use(express.json());
  api.post(['/v1/responses', '/api/v1/chat/completions'], (req, res) => {
    requests.push({ path: req.path, authorization: req.headers.authorization, headers: req.headers, body: req.body });
    if (options.status) { res.status(options.status).json({ error: { message: 'private-provider-payload local-router-key', type: 'invalid_request_error' } }); return; }
    const content = options.content ?? JSON.stringify(proposal);
    if (req.path === '/v1/responses') {
      res.json({
        id: 'resp_test', object: 'response', created_at: 1700000000, model: req.body.model, status: 'completed',
        output: [{ type: 'message', role: 'assistant', id: 'msg_test', status: 'completed', content: [{ type: 'output_text', text: content, annotations: [] }] }],
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      });
    } else {
      res.json({
        id: 'chatcmpl_test', object: 'chat.completion', created: 1700000000, model: req.body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });
    }
  });
  const server = await listen(api);
  const adapterFetch: typeof fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : resource.toString());
    endpoints.push(url.href);
    assert.ok(['https://api.openai.com/v1/responses', 'https://openrouter.ai/api/v1/chat/completions'].includes(url.href));
    return fetch(`${server.url}${url.pathname}`, init);
  };
  return { requests, endpoints, fetch: adapterFetch, close: () => stop(server.server) };
}

test('the actual OpenAI Agents SDK keeps direct Responses and router Chat Completions isolated', async () => {
  const fixture = await plannerFixture();
  try {
    const direct = createPlanner({ modelProvider: 'openai', modelApiKey: 'local-direct-key', model: 'gpt-4.1-mini' }, { fetch: fixture.fetch });
    const router = createPlanner({ modelProvider: 'openrouter', modelApiKey: 'local-router-key', model: 'meta-llama/llama-3.3-70b-instruct:free' }, { fetch: fixture.fetch });
    assert.deepEqual(await Promise.all([direct(input), router(input)]), [proposal, proposal]);
    assert.deepEqual([...fixture.endpoints].sort(), ['https://api.openai.com/v1/responses', 'https://openrouter.ai/api/v1/chat/completions']);
    const directRequest = fixture.requests.find((request) => request.path === '/v1/responses');
    assert.ok(directRequest);
    assert.equal(directRequest.authorization, 'Bearer local-direct-key');
    assert.equal(directRequest.body.model, 'gpt-4.1-mini');
    assert.equal(directRequest.body.text?.format.type, 'json_schema');
    assert.equal(directRequest.body.text?.format.strict, true);
    assert.deepEqual(directRequest.body.tools, []);
    assert.equal(directRequest.body.provider, undefined);
    const routerRequest = fixture.requests.find((request) => request.path === '/api/v1/chat/completions');
    assert.ok(routerRequest);
    assert.equal(routerRequest.authorization, 'Bearer local-router-key');
    assert.equal(routerRequest.body.model, 'meta-llama/llama-3.3-70b-instruct:free');
    assert.equal(routerRequest.body.response_format?.type, 'json_schema');
    assert.equal(routerRequest.body.response_format?.json_schema.strict, true);
    assert.deepEqual(routerRequest.body.response_format?.json_schema.schema, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object', properties: { reply: { type: 'string', minLength: 1, maxLength: 1200 }, requestLabel: { type: ['string', 'null'] } },
      required: ['reply', 'requestLabel'], additionalProperties: false,
    });
    assert.deepEqual(routerRequest.body.provider, { require_parameters: true });
    assert.equal(routerRequest.body.tools, undefined);
    assert.deepEqual(routerRequest.body.messages?.slice(-3), [
      { role: 'user', content: [{ type: 'text', text: 'The name is team-lunch' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Ready to propose it.' }] }, { role: 'user', content: [{ type: 'text', text: 'Save it' }] },
    ]);
    for (const request of fixture.requests) {
      const sent = JSON.stringify(request.body);
      assert.ok(sent.includes('Alice')); assert.ok(sent.includes('team-lunch'));
      assert.ok(sent.includes('You have no execution tools'));
    }
  } finally { await fixture.close(); }
});

test('router requests ignore inherited OpenAI credentials and custom headers while direct requests retain them', async () => {
  const fixture = await plannerFixture();
  const inherited = {
    OPENAI_API_KEY: 'private-openai-key',
    OPENAI_ADMIN_KEY: 'private-openai-admin-key',
    OPENAI_ORG_ID: 'private-openai-org',
    OPENAI_PROJECT_ID: 'private-openai-project',
    OPENAI_CUSTOM_HEADERS: [
      'aUtHoRiZaTiOn: Bearer direct-openai-header-sentinel',
      'OpenAI-Organization: private-org-sentinel',
      'OpenAI-Project: private-project-sentinel',
      'X-Private-Header: private-header-sentinel',
    ].join('\n'),
  };
  const previous = Object.fromEntries(Object.keys(inherited).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, inherited);
    const router = createPlanner({ modelProvider: 'openrouter', modelApiKey: 'local-router-key', model: 'openai/gpt-4.1-mini' }, { fetch: fixture.fetch });
    const direct = createPlanner({ modelProvider: 'openai', modelApiKey: 'local-direct-key', model: 'gpt-4.1-mini' }, { fetch: fixture.fetch });
    assert.deepEqual(await Promise.all([router(input), direct(input)]), [proposal, proposal]);
    const routerRequest = fixture.requests.find((request) => request.path === '/api/v1/chat/completions');
    assert.ok(routerRequest);
    assert.equal(routerRequest.authorization, 'Bearer local-router-key');
    assert.equal(routerRequest.headers['openai-organization'], undefined);
    assert.equal(routerRequest.headers['openai-project'], undefined);
    assert.equal(routerRequest.headers['x-private-header'], undefined);
    assert.ok(!JSON.stringify(routerRequest.headers).includes('private-'));
    const directRequest = fixture.requests.find((request) => request.path === '/v1/responses');
    assert.ok(directRequest);
    assert.equal(directRequest.authorization, 'Bearer direct-openai-header-sentinel');
    assert.equal(directRequest.headers['openai-organization'], 'private-org-sentinel');
    assert.equal(directRequest.headers['openai-project'], 'private-project-sentinel');
    assert.equal(directRequest.headers['x-private-header'], 'private-header-sentinel');
    for (const [key, value] of Object.entries(inherited)) assert.equal(process.env[key], value);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fixture.close();
  }
});

test('a router conversation may return a validated reply without proposing an action', async () => {
  const expected = { reply: 'Hello Alice.', requestLabel: null };
  const fixture = await plannerFixture({ content: JSON.stringify(expected) });
  try {
    const plan = createPlanner({ modelProvider: 'openrouter', modelApiKey: 'local-router-key', model: 'openai/gpt-4.1-mini' }, { fetch: fixture.fetch });
    assert.deepEqual(await plan({ ...input, text: 'Hello', history: [] }), expected);
  } finally { await fixture.close(); }
});

test('router failures and invalid structured output fail without fallback or sensitive diagnostics', async (context) => {
  for (const options of [
    { content: 'not json private-provider-payload' },
    { content: JSON.stringify({ reply: '', requestLabel: null }) },
    { content: JSON.stringify({ reply: 'Hi', requestLabel: { malicious: true } }) },
    { status: 400 }, { status: 401 }, { status: 404 },
  ]) {
    const fixture = await plannerFixture(options);
    const logger = context.mock.method(console, 'error', () => {});
    try {
      const plan = createPlanner({ modelProvider: 'openrouter', modelApiKey: 'local-router-key', model: 'openai/gpt-4.1-mini' }, { fetch: fixture.fetch });
      await assert.rejects(plan(input), (error: Error) => { reportError('Planning failed', error); return true; });
      assert.deepEqual(fixture.endpoints, ['https://openrouter.ai/api/v1/chat/completions']);
      const output = logger.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
      assert.ok(output.includes('Planning failed'));
      assert.ok(!output.includes('private-provider-payload'));
      assert.ok(!output.includes('local-router-key'));
      assert.ok(!output.includes('team-lunch'));
    } finally { logger.mock.restore(); await fixture.close(); }
  }
});
