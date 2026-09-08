import { defineConfig } from "@trigger.dev/sdk";

/**
 * Set `project` to your own project ref from the Trigger.dev dashboard
 * (it looks like `proj_abcdefghijklmnop`), or via TRIGGER_PROJECT_REF.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me",
  dirs: ["./src/trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 30_000 },
  },
});
