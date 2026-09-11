import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import express from 'express';
import { setDefaultOpenAIKey, setTracingDisabled } from '@openai/agents';
import { createPlanner } from '../src/agent.js';

test('the actual OpenAI Agents SDK uses structured output and authenticated conversation context', async () => {
  const api = express(); api.use(express.json());
  let request: Record<string, unknown> | undefined;
  api.post('/responses', (req, res) => {
    request = req.body;
    res.json({
      id: 'resp_test', object: 'response', created_at: Math.floor(Date.now() / 1000), model: 'gpt-4.1-mini', status: 'completed',
      output: [{ type: 'message', role: 'assistant', id: 'msg_test', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ reply: 'Please approve on your phone.', requestLabel: 'team-lunch' }), annotations: [] }] }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  });
  const server = createServer(api);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const oldBase = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}`;
  setDefaultOpenAIKey('local-test-key'); setTracingDisabled(true);
  try {
    const plan = createPlanner('gpt-4.1-mini');
    const result = await plan({ identity: { sub: 'auth0|alice', name: 'Alice' }, text: 'Save it', history: [{ role: 'user', content: 'The name is team-lunch' }, { role: 'assistant', content: 'Ready to propose it.' }] });
    assert.equal(result.requestLabel, 'team-lunch');
    assert.equal(request?.model, 'gpt-4.1-mini');
    const sent = JSON.stringify(request);
    assert.ok(sent.includes('Alice')); assert.ok(sent.includes('team-lunch')); assert.ok(sent.includes('json_schema'));
    assert.deepEqual(request?.tools, []);
  } finally {
    if (oldBase === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = oldBase;
    server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
