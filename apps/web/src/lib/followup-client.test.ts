import assert from "node:assert/strict";
import test from "node:test";
import { createFollowupClient } from "./followup-client";
test("parallel reads and proposals wait for a single completed session handshake", async () => {
  const urls: string[] = [];
  let sessionReady = false;
  let release: () => void = () => {
    throw new Error("not initialized");
  };
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const request = createFollowupClient(async (url) => {
    urls.push(url);
    if (url.includes("session=1")) {
      await hold;
      sessionReady = true;
    } else assert.equal(sessionReady, true);
    return Response.json({ status: "ready" });
  });
  const reads = [
    request("?incidentId=INC-1042"),
    request("?incidentId=INC-1043"),
    request("", { operation: "propose" }),
  ];
  assert.deepEqual(urls, ["/api/followups?session=1"]);
  release();
  await Promise.all(reads);
  assert.equal(urls.filter((url) => url.includes("session=1")).length, 1);
  assert.equal(urls.length, 4);
});
test("a failed handshake can be retried and never sends a proposal", async () => {
  let calls = 0;
  const request = createFollowupClient(async () => {
    calls++;
    return new Response(null, { status: 503 });
  });
  await assert.rejects(request("", { operation: "propose" }), /session/);
  await assert.rejects(request("", { operation: "propose" }), /session/);
  assert.equal(calls, 2);
});
