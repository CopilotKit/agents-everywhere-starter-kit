import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FollowupService } from "./followups";
import type { Workplace, WorkplaceTask } from "./workplace";

const session = "a".repeat(64);
const input = {
  incidentId: "INC-1042",
  title: "Check pool metrics",
  details: "Compare before and after deploy.",
};
class FakeWorkplace implements Workplace {
  workspaceId = "workspace-a";
  tasks: WorkplaceTask[] = [];
  creates = 0;
  reads = 0;
  failure: "before" | "after" | undefined;
  async identity() {
    return { id: "user-a", workspaceId: this.workspaceId, name: "Demo agent" };
  }
  async list(marker: string) {
    this.reads++;
    return this.tasks.filter((t) => t.description.includes(marker));
  }
  async get(id: string) {
    this.reads++;
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error("not found");
    return task;
  }
  async create(
    title: string,
    description: string,
    beforeWrite: () => Promise<void>,
  ) {
    await beforeWrite();
    this.creates++;
    if (this.failure === "before") throw new Error("provider unavailable");
    const task = {
      id: "11111111-1111-4111-8111-111111111111",
      title,
      description,
      url: null,
    };
    this.tasks.push(task);
    if (this.failure === "after") throw new Error("lost response");
    return task;
  }
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "web-followups-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const provider = new FakeWorkplace();
  let now = Date.now();
  const service = new FollowupService(provider, directory, () => now);
  return {
    service,
    provider,
    directory,
    expire: () => {
      now += 11 * 60_000;
    },
  };
}

test("a proposal performs no write; approval writes exactly the displayed fields and reads back", async (t) => {
  const { service, provider } = await fixture(t);
  const proposal = await service.propose(session, input);
  assert.equal(provider.creates, 0);
  const task = await service.approve(session, proposal.id);
  assert.equal(task.title, proposal.title);
  assert.equal(task.description, proposal.description);
  assert.equal(provider.creates, 1);
  assert.ok(provider.reads > 0);
});

test("missing, foreign-session, denied, and expired proposals cannot write", async (t) => {
  const { service, provider, expire } = await fixture(t);
  await assert.rejects(service.approve(session, "missing"));
  const proposal = await service.propose(session, input);
  await assert.rejects(service.approve("b".repeat(64), proposal.id), /session/);
  await service.deny(session, proposal.id);
  await assert.rejects(service.approve(session, proposal.id), /declined/);
  const next = await service.propose(session, input);
  expire();
  await assert.rejects(service.approve(session, next.id), /expired/);
  assert.equal(provider.creates, 0);
});

test("workspace changes invalidate the exact consent", async (t) => {
  const { service, provider } = await fixture(t);
  const proposal = await service.propose(session, input);
  provider.workspaceId = "workspace-b";
  await assert.rejects(service.approve(session, proposal.id), /workspace/);
  assert.equal(provider.creates, 0);
});

test("concurrent approval and restart cannot duplicate a saved task; refresh reads the provider", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const p = await service.propose(session, input);
  const results = await Promise.allSettled([
    service.approve(session, p.id),
    service.approve(session, p.id),
  ]);
  assert.ok(results.some((r) => r.status === "fulfilled"));
  assert.equal(provider.creates, 1);
  const restarted = new FollowupService(provider, directory);
  await restarted.approve(session, p.id);
  const before = provider.reads;
  assert.equal((await restarted.list("INC-1042"))[0].id, provider.tasks[0].id);
  assert.ok(provider.reads > before);
  const another = await restarted.propose(session, input);
  await restarted.approve(session, another.id);
  assert.equal(provider.creates, 1);
});

test("an uncertain write is never retried, including after restart and a new proposal", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const p = await service.propose(session, input);
  provider.failure = "before";
  await assert.rejects(service.approve(session, p.id), /uncertain/);
  provider.failure = undefined;
  const restarted = new FollowupService(provider, directory);
  await assert.rejects(restarted.approve(session, p.id), /uncertain/);
  const another = await restarted.propose(session, input);
  await assert.rejects(restarted.approve(session, another.id), /uncertain/);
  assert.equal(provider.creates, 1);
});

test("a lost create reply is reconciled from Ambiguous without a second create", async (t) => {
  const { service, provider, directory } = await fixture(t);
  const p = await service.propose(session, input);
  provider.failure = "after";
  await assert.rejects(service.approve(session, p.id), /uncertain/);
  const restarted = new FollowupService(provider, directory);
  const task = await restarted.approve(session, p.id);
  assert.equal(task.id, provider.tasks[0].id);
  assert.equal(provider.creates, 1);
});

test("invalid proposal inputs fail before provider writes", async (t) => {
  const { service, provider } = await fixture(t);
  await assert.rejects(
    service.propose(session, { ...input, incidentId: "unknown" }),
  );
  await assert.rejects(service.propose(session, { ...input, title: " " }));
  await assert.rejects(
    service.propose(session, { ...input, details: "x".repeat(4001) }),
  );
  assert.equal(provider.creates, 0);
});

test("schema discovery failure before the write guard remains retryable", async (t) => {
  const { service, provider } = await fixture(t);
  const original = provider.create.bind(provider);
  provider.create = async () => {
    throw new Error("schema unavailable");
  };
  const p = await service.propose(session, input);
  await assert.rejects(service.approve(session, p.id), /schema/);
  provider.create = original;
  await service.approve(session, p.id);
  assert.equal(provider.creates, 1);
});

test("read-back fields must match the exact approved payload", async (t) => {
  const { service, provider } = await fixture(t);
  const original = provider.get.bind(provider);
  provider.get = async (id) => ({
    ...(await original(id)),
    title: "Unexpected changed title",
  });
  const p = await service.propose(session, input);
  await assert.rejects(
    service.approve(session, p.id),
    /differs from the approved fields/,
  );
  assert.equal(provider.creates, 1);
});
