import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { verifyMcp } from "./verify-mcp.mjs";

async function runVerifier(t, testExitCode = 0) {
  const root = await mkdtemp(join(tmpdir(), "offline-verifier-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts"));
  await mkdir(join(root, "bin"));
  await copyFile(new URL("./verify.sh", import.meta.url), join(root, "scripts/verify.sh"));
  // A preflight sentinel must never be run by offline verification.
  await writeFile(join(root, "scripts/check-env.sh"), `echo PREFLIGHT_CALLED; exit ${testExitCode ? 0 : 1}\n`);
  await writeFile(join(root, "bin/npm"), `#!/bin/sh
if [ "$1" = "test" ]; then
  echo '# pass 13'
  echo '# fail 0'
  echo 'later workspace failed'
  exit ${testExitCode}
fi
exit 0
`, { mode: 0o755 });
  await writeFile(join(root, "bin/node"), "#!/bin/sh\necho 'MCP protocol passed'\n", { mode: 0o755 });
  return spawnSync("bash", [join(root, "scripts/verify.sh")], {
    env: { PATH: `${join(root, "bin")}:${process.env.PATH}` },
    encoding: "utf8",
    timeout: 15000,
  });
}

test("offline verification succeeds without .env or provider credentials", async (t) => {
  const result = await runVerifier(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /PREFLIGHT_CALLED/);
  assert.match(result.stdout, /Mobile — separate install, typecheck, and device run not verified/);
});

test("a later workspace's nonzero test status fails verification", async (t) => {
  const result = await runVerifier(t, 7);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /later workspace failed/);
});

// Real subprocesses: these prove ownership/cleanup, without live model calls.

class TrackedTransport extends StdioClientTransport {
  ownedPid;
  async start() {
    await super.start();
    this.ownedPid = this.pid;
  }
}

function assertChildStopped(transport) {
  assert.equal(typeof transport.ownedPid, "number");
  assert.throws(() => process.kill(transport.ownedPid, 0), { code: "ESRCH" });
}

test("MCP checks use the real stdio server and close their child", async () => {
  const transport = new TrackedTransport({
    command: process.execPath,
    args: ["--import", "tsx", "apps/mcp/src/stdio.ts"],
    env: {},
    stderr: "pipe",
  });
  await verifyMcp({ transport });
  assertChildStopped(transport);
});

test("MCP timeout fails explicitly and closes only its owned child", async (t) => {
  const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  t.after(() => unrelated.kill());
  const transport = new TrackedTransport({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    env: {},
    stderr: "pipe",
  });
  await assert.rejects(verifyMcp({ transport, timeoutMs: 100 }), /timed out/);
  assertChildStopped(transport);
  assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
});

test("MCP startup failure rejects instead of claiming protocol success", async () => {
  const transport = new TrackedTransport({
    command: process.execPath,
    args: ["-e", "process.exit(2)"],
    env: {},
    stderr: "pipe",
  });
  await assert.rejects(verifyMcp({ transport }), /closed/i);
  assertChildStopped(transport);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`MCP ${signal} handler rejects and cleans up its child`, async () => {
    const before = process.listeners(signal);
    const transport = new TrackedTransport({
      command: process.execPath,
      args: ["-e", "process.stderr.write('ready'); setInterval(() => {}, 1000)"],
      env: {},
      stderr: "pipe",
    });
    // Deliver the signal event once the owned child is alive and blocked in initialize.
    transport.stderr.once("data", () => process.emit(signal));
    await assert.rejects(verifyMcp({ transport }), new RegExp(signal));
    assertChildStopped(transport);
    assert.deepEqual(process.listeners(signal), before);
  });
}

test("an MCP request error fails verification and still closes the child", async () => {
  const transport = new TrackedTransport({
    command: process.execPath,
    args: ["-e", `
      require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
        const request = JSON.parse(line);
        if (request.id === undefined) return;
        const response = request.method === 'initialize'
          ? { result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'broken', version: '1' } } }
          : { error: { code: -32603, message: 'tools unavailable' } };
        console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...response }));
      });
    `],
    env: {},
    stderr: "pipe",
  });
  await assert.rejects(verifyMcp({ transport }), /tools unavailable/);
  assertChildStopped(transport);
});
