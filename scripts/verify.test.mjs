import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

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
  assert.match(result.stdout, /Mobile — separate install, typecheck, bundle, and device run under apps\/mobile/);
  assert.doesNotMatch(result.stdout, /MCP stdio protocol|MCP HTTP transport/);
});

test("a later workspace's nonzero test status fails verification", async (t) => {
  const result = await runVerifier(t, 7);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /later workspace failed/);
});
