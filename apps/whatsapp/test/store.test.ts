import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';

for (const mismatch of ['legacy', 'phone-number'] as const) {
  test(`existing ${mismatch} state is never silently attributed to the Meta sender`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'meta-state-'));
    try {
      const file = join(directory, 'state.json');
      const store = new Store(file, '123');
      store.data.identities['15550000001'] = { sub: 'auth0|alice', name: 'Alice' };
      store.save();
      if (mismatch === 'legacy') {
        const legacy = { ...store.data, version: 1, transport: undefined };
        writeFileSync(file, JSON.stringify(legacy));
      }
      const before = readFileSync(file, 'utf8');
      assert.throws(() => new Store(file, mismatch === 'legacy' ? '123' : '456'), /LEGACY_STATE_REQUIRES_MIGRATION|STATE_DESTINATION_MISMATCH/);
      assert.equal(readFileSync(file, 'utf8'), before);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}

test('restart marks interrupted external work uncertain without replay and preserves pending approvals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'meta-restart-'));
  try {
    const file = join(directory, 'state.json');
    const store = new Store(file, '123');
    const action = { id: 'REQUEST', from: '15550000001', sub: 'auth0|alice', label: 'team-lunch', actionHash: 'saved-hash', createdAt: 1, expiresAt: 300001, nextPollAt: 5001, interval: 5 };
    store.data.approvals.REQUEST = { ...action, status: 'initiating' };
    store.data.approvals.PENDING = { ...action, id: 'PENDING', status: 'pending', authReqId: 'auth0-request' };
    store.data.inbox['wamid.processing'] = { from: action.from, body: 'save', receivedAt: 1, status: 'processing' };
    store.data.outbox.reply = { from: action.from, body: 'saved', createdAt: 1, status: 'sending' };
    store.data.links.exchanging = { from: action.from, expiresAt: 300001, phase: 'exchanging' };
    store.save();
    const restarted = new Store(file, '123');
    assert.equal(restarted.data.approvals.REQUEST.status, 'failed');
    assert.equal(restarted.data.approvals.PENDING.status, 'pending');
    assert.equal(restarted.data.inbox['wamid.processing'].status, 'failed');
    assert.equal(restarted.data.outbox.reply.status, 'failed');
    assert.equal(restarted.data.links.exchanging, undefined);
    assert.deepEqual(restarted.data.records, {});
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
