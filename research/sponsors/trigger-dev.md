# Trigger.dev — developer infrastructure partner

Open-source background jobs framework: reliable workflows in plain async code. Queuing, retries, elastic scaling, real-time monitoring, no timeouts.

## Verified surface (`@trigger.dev/sdk` **4.5.16**, published 2026-09-08)

```bash
npx trigger.dev@latest init    # creates /trigger dir + trigger.config.ts
npx trigger.dev@latest dev
```

`TRIGGER_SECRET_KEY=tr_dev_sk_...` (create with "Trigger only" access in the Development environment).

**API hygiene the docs are emphatic about:** always import from `@trigger.dev/sdk`, never `@trigger.dev/sdk/v3`; never `client.defineJob()` (deprecated v2).

Trigger from your app with a type-only import so task code doesn't get bundled:

```ts
import type { myTask } from "./trigger/example";
import { tasks } from "@trigger.dev/sdk";
const handle = await tasks.trigger<typeof myTask>("hello-world", { message: "..." });
```

Features: scheduled/cron tasks, concurrency + queues, retries, machines, Realtime API with React hooks, build extensions (`pythonExtension`, `playwright`, `puppeteer`, `ffmpeg`, `prismaExtension`).

## Waitpoints — the killer combination with Channels

`wait.forToken()` pauses a run until something external completes it. **This is exactly the shape of a human-in-the-loop approval in a chat thread.**

```ts
import { wait } from "@trigger.dev/sdk";

const token = await wait.createToken({ timeout: "10m", tags: ["user:123"] });
// token.id  → waitpoint_...
// token.url → server-to-server webhook callback (no CORS)
// token.publicAccessToken → client-side completion (CORS enabled)

const result = await wait.forToken<{ status: "approved" | "rejected" }>(token.id);
if (result.ok) { /* result.output.status */ } else { /* timed out */ }
```

Complete it from anywhere — SDK (`wait.completeToken`), browser fetch, cURL, Python, Ruby, Go — or hand `token.url` to a third-party service as a webhook. Plus `wait.listTokens()` / `wait.retrieveToken()`, idempotency keys with TTL, and tags.

## The pattern to ship in the kit

> **Slack button → Trigger.dev waitpoint → durable long-running work.**
>
> A Channels `Actions`/`Button` click completes a waitpoint; the task resumes and runs for minutes or hours without holding the chat turn open. This solves the one thing a Channels listener genuinely cannot do on its own — survive long work across restarts — and it is a natural, honest use of two sponsors together.

Docs: [trigger.dev/docs/quick-start](https://trigger.dev/docs/quick-start) · [wait-for-token](https://trigger.dev/docs/wait-for-token) · index: [trigger.dev/docs/llms.txt](https://trigger.dev/docs/llms.txt)
