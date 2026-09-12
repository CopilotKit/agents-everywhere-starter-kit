import { closePool, getPool } from "procure-db";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { localToday } from "./deps";
import { createSmtpMailer } from "./lib/mailer";
import { createRunQueue } from "./lib/queue";

const config = loadConfig();
const queue = createRunQueue(config.redisUrl);
const app = createApp({
  pool: getPool(),
  config,
  mailer: createSmtpMailer(config.smtp),
  queue,
  today: localToday,
  log: (message, error) => console.error(`[procure-api] ${message}`, error ?? ""),
});

const server = app.listen(config.port, () => {
  console.log(`\n  ✓ Procurebot api on http://localhost:${config.port}  (/api, /portal, /healthz)\n`);
});

const shutdown = async () => {
  server.close();
  await Promise.allSettled([queue.close(), closePool()]);
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
