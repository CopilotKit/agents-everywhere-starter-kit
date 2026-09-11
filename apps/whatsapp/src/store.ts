import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const identity = z.object({ sub: z.string(), name: z.string() });
const stateSchema = z.object({
  version: z.literal(1),
  identities: z.record(z.string(), identity),
  links: z.record(z.string(), z.object({
    from: z.string(), expiresAt: z.number(), state: z.string().optional(), nonce: z.string().optional(),
    verifier: z.string().optional(), browserHash: z.string().optional(),
    phase: z.enum(['new', 'login', 'exchanging', 'confirm']),
    identity: identity.optional(), confirmationHash: z.string().optional(),
  })),
  inbox: z.record(z.string(), z.object({
    from: z.string(), body: z.string(), receivedAt: z.number(), status: z.enum(['queued', 'processing', 'done', 'failed']),
  })),
  history: z.record(z.string(), z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))),
  approvals: z.record(z.string(), z.object({
    id: z.string(), from: z.string(), sub: z.string(), label: z.string(), actionHash: z.string(),
    status: z.enum(['initiating', 'pending', 'saved', 'denied', 'expired', 'failed']),
    createdAt: z.number(), expiresAt: z.number(), nextPollAt: z.number(), interval: z.number(), authReqId: z.string().optional(),
  })),
  records: z.record(z.string(), z.object({ id: z.string(), sub: z.string(), label: z.string(), createdAt: z.number() })),
  outbox: z.record(z.string(), z.object({ from: z.string(), body: z.string(), createdAt: z.number(), status: z.enum(['queued', 'sending', 'sent', 'failed']) })),
});
export type State = z.infer<typeof stateSchema>;
export type Identity = State['identities'][string];
export type Approval = State['approvals'][string];

/** Single-process demo storage. No shared volume, replicas, or untrusted local writers. */
export class Store {
  data: State;
  constructor(private readonly file: string) {
    this.data = existsSync(file) ? stateSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : {
      version: 1, identities: {}, links: {}, inbox: {}, history: {}, approvals: {}, records: {}, outbox: {},
    };
    // An interrupted external call has an uncertain outcome. Never repeat it automatically.
    for (const item of Object.values(this.data.inbox)) if (item.status === 'processing') item.status = 'failed';
    for (const item of Object.values(this.data.approvals)) if (item.status === 'initiating') item.status = 'failed';
    for (const item of Object.values(this.data.outbox)) if (item.status === 'sending') item.status = 'failed';
    for (const [key, item] of Object.entries(this.data.links)) if (item.phase === 'exchanging') delete this.data.links[key];
    this.save();
  }
  save() {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.tmp`;
    const fd = openSync(temporary, 'w', 0o600);
    try { writeFileSync(fd, JSON.stringify(this.data, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, this.file);
  }
}
