import assert from "node:assert/strict";
import { test } from "node:test";
import { executeResearch, reportResearch, requireResearchConfig, type ResearchPayload } from "./research";

const payload: ResearchPayload = {
  tokenId: "wait_123", request: "Find incident mitigation references",
  origin: { channelCode: "incident-agent", platform: "slack", conversationKey: "workspace:channel:thread-1" },
};
const findings = [{ title: "Mitigation", url: "https://example.com/mitigation", highlight: "Roll back the change." }];

test("approved research searches; reporting uses the captured original thread and includes sources", async () => {
  let searches = 0;
  const output = await executeResearch(payload, {
    waitForDecision: async () => ({ ok: true, output: { approved: true } }),
    search: async (request) => { assert.equal(request, payload.request); searches++; return findings; },
  });
  const posts: string[] = [];
  await reportResearch("run_123", payload.origin, {
    retrieve: async () => ({ status: "COMPLETED", payload, output }),
    post: async (text) => { posts.push(text); },
  });
  assert.equal(searches, 1);
  assert.match(posts[0], /run_123/);
  assert.match(posts.join("\n"), /https:\/\/example.com\/mitigation/);
});

for (const status of ["declined", "timed_out"] as const) {
  test(`${status} never searches and is reported`, async () => {
    const output = await executeResearch(payload, {
      waitForDecision: async () => status === "declined" ? { ok: true, output: { approved: false } } : { ok: false },
      search: async () => { assert.fail("must not search"); },
    });
    assert.equal(output.status, status);
    let posted = "";
    await reportResearch("run_123", payload.origin, {
      retrieve: async () => ({ status: "COMPLETED", payload, output }),
      post: async (text) => { posted = text; },
    });
    assert.match(posted, status === "declined" ? /declined/i : /timed out/i);
  });
}

for (const output of [{ approved: "false" }, { approved: "true" }, { approved: 1 }, { approved: {} }, { approved: null }, {}, null, undefined]) {
  test(`malformed persisted decision ${JSON.stringify(output)} rejects without searching`, async () => {
    let searches = 0;
    await assert.rejects(executeResearch(payload, {
      waitForDecision: async () => ({ ok: true, output }),
      search: async () => { searches++; return findings; },
    }), { name: "ZodError" });
    assert.equal(searches, 0);
  });
}

test("search failures reject the worker and failed Trigger status is reported", async () => {
  const failure = new Error("Exa unavailable");
  await assert.rejects(executeResearch(payload, {
    waitForDecision: async () => ({ ok: true, output: { approved: true } }),
    search: async () => { throw failure; },
  }), (error) => error === failure);
  let posted = "";
  await reportResearch("run_123", payload.origin, {
    retrieve: async () => ({ status: "FAILED", payload }),
    post: async (text) => { posted = text; },
  });
  assert.match(posted, /FAILED/);
});

test("cannot retrieve another thread's research", async () => {
  await assert.rejects(reportResearch("run_123", { ...payload.origin, conversationKey: "another-thread" }, {
    retrieve: async () => ({ status: "COMPLETED", payload, output: { status: "done", findings } }),
    post: async () => { assert.fail("must not post private findings"); },
  }), /original conversation/);
});

test("notification failures surface independently from completed research", async () => {
  await assert.rejects(reportResearch("run_123", payload.origin, {
    retrieve: async () => ({ status: "COMPLETED", payload, output: { status: "done", findings } }),
    post: async () => { throw new Error("delivery unavailable"); },
  }), /delivery unavailable/);
});

test("missing Exa returned as text cannot be mistaken for research success", async () => {
  await assert.rejects(executeResearch(payload, {
    waitForDecision: async () => ({ ok: true, output: { approved: true } }),
    search: async () => "Web search is not configured",
  }), /Web search is not configured/);
});

for (const name of ["EXA_API_KEY", "TRIGGER_PROJECT_REF", "TRIGGER_SECRET_KEY"] as const) {
  test(`missing ${name} fails before queueing research`, () => {
    const env = { EXA_API_KEY: "test-key", TRIGGER_PROJECT_REF: "proj_123", TRIGGER_SECRET_KEY: "test-key" };
    assert.throws(() => requireResearchConfig({ ...env, [name]: "   " }), new RegExp(name));
  });
}
test("placeholder Trigger project is rejected", () => {
  assert.throws(() => requireResearchConfig({ EXA_API_KEY: "test", TRIGGER_PROJECT_REF: "proj_replace_me", TRIGGER_SECRET_KEY: "test" }), /TRIGGER_PROJECT_REF/);
});
