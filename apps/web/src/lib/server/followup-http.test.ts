import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFollowupHandler } from "./followup-http";
import type { Workplace, WorkplaceTask } from "./workplace";
const origin = "http://localhost:3100";
const cookie = `web-followup-session=${"a".repeat(64)}`;
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/followups`, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const proposal = {
  operation: "propose",
  incidentId: "INC-1042",
  title: "Compare metrics",
  details: "Use the selected incident context.",
};

test("unconfigured GET establishes a protected session, while writes fail explicitly", async () => {
  const handler = createFollowupHandler({
    connect: () => undefined,
    directory: "/unused",
  });
  const response = await handler(new Request(`${origin}/api/followups`));
  assert.equal((await response.json()).status, "unconfigured");
  assert.match(
    response.headers.get("set-cookie")!,
    /HttpOnly; SameSite=Strict/,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await handler(request(proposal))).status, 503);
});

test("cross-origin posts, absent sessions, and form bodies cannot reach a provider", async () => {
  let connects = 0;
  const handler = createFollowupHandler({
    connect: () => {
      connects++;
      return undefined;
    },
    directory: "/unused",
  });
  const invalidHeaders: Record<string, string>[] = [
    { origin: "https://evil.example" },
    { cookie: "" },
    { "content-type": "application/x-www-form-urlencoded" },
    { origin: "" },
  ];
  for (const headers of invalidHeaders) {
    assert.equal((await handler(request(proposal, headers))).status, 403);
  }
  assert.equal(connects, 0);
});

test("HTTP proposal/approval/read flow rejects edited fields and never writes on reads", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "web-http-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const records: WorkplaceTask[] = [];
  let creates = 0;
  const workplace: Workplace = {
    async identity() {
      return { id: "u1", workspaceId: "w1", name: "Test identity" };
    },
    async list(marker) {
      return records.filter((r) => r.description.includes(marker));
    },
    async get(id) {
      const record = records.find((r) => r.id === id);
      if (!record) throw new Error("missing");
      return record;
    },
    async create(title, description, beforeWrite) {
      await beforeWrite();
      creates++;
      const record = {
        id: "11111111-1111-4111-8111-111111111111",
        title,
        description,
        url: null,
      };
      records.push(record);
      return record;
    },
  };
  const handler = createFollowupHandler({
    connect: () => ({ workplace, async close() {} }),
    directory,
  });
  const response = await handler(request(proposal));
  const { proposal: prepared } = await response.json();
  assert.equal(creates, 0);
  assert.equal(
    (
      await handler(
        request({
          operation: "approve",
          proposalId: prepared.id,
          title: "edited by client",
        }),
      )
    ).status,
    400,
  );
  assert.equal(creates, 0);
  const saved = await handler(
    request({ operation: "approve", proposalId: prepared.id }),
  );
  assert.equal(saved.status, 200);
  const { task } = await saved.json();
  assert.equal(task.description, prepared.description);
  const refreshed = await handler(
    new Request(`${origin}/api/followups?incidentId=INC-1042`, {
      headers: { cookie },
    }),
  );
  assert.equal((await refreshed.json()).tasks[0].id, task.id);
  const retrieved = await handler(
    new Request(`${origin}/api/followups?taskId=${task.id}`, {
      headers: { cookie },
    }),
  );
  assert.equal((await retrieved.json()).task.id, task.id);
  assert.equal(creates, 1);
});

test("provider credential errors remain errors and never leak arbitrary provider text", async () => {
  const handler = createFollowupHandler({
    connect: () => {
      throw new Error("Bearer secret-api-key");
    },
    directory: "/unused",
  });
  const response = await handler(new Request(`${origin}/api/followups`));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /credentials/);
  assert.doesNotMatch(body, /secret-api-key/);
});

test("session bootstrap returns before any provider connection and does not reset an established cookie", async () => {
  let connects = 0;
  const handler = createFollowupHandler({
    connect: () => {
      connects++;
      throw new Error("should not connect");
    },
    directory: "/unused",
  });
  const response = await handler(
    new Request(`${origin}/api/followups?session=1`),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie")!, /web-followup-session=/);
  const established = await handler(
    new Request(`${origin}/api/followups?session=1`, { headers: { cookie } }),
  );
  assert.equal(established.headers.get("set-cookie"), null);
  assert.equal(connects, 0);
});

test("a loopback Host preserved by Next accepts only its matching browser Origin", async () => {
  const handler = createFollowupHandler({
    connect: () => undefined,
    directory: "/unused",
  });
  const accepted = await handler(
    request(proposal, {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3100",
    }),
  );
  assert.equal(accepted.status, 503); // Origin passed; Ambiguous is unconfigured.
  for (const origin of [
    "https://evil.example",
    "http://127.0.0.1:3101",
    "https://127.0.0.1:3100",
  ]) {
    assert.equal(
      (await handler(request(proposal, { host: "127.0.0.1:3100", origin })))
        .status,
      403,
    );
  }
});

test("an attacker-controlled matching Host and Origin cannot bootstrap or call the provider", async () => {
  let connects = 0;
  const handler = createFollowupHandler({
    connect: () => {
      connects++;
      return undefined;
    },
    directory: "/unused",
  });
  const headers = {
    host: "attacker.example:3100",
    origin: "http://attacker.example:3100",
  };
  for (const incoming of [
    request(proposal, headers),
    new Request(`${origin}/api/followups?session=1`, { headers }),
    new Request(`${origin}/api/followups`, { headers }),
  ]) {
    assert.equal((await handler(incoming)).status, 403);
  }
  assert.equal(connects, 0);
});
