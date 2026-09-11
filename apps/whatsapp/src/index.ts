import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { setTracingDisabled } from '@openai/agents';
import { readConfig } from './config.js';
import { createService } from './service.js';
import { reportError } from './diagnostics.js';

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
// Conversation data still goes to the model. Disable separate trace export in this demo.
setTracingDisabled(true);
const config = readConfig(process.env);
const { app, tick } = createService(config);
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`WhatsApp agent listening on port ${config.port}. Health: /health. Webhook: ${config.publicBaseUrl}/webhooks/whatsapp`);
});
let stopping = false;
let running = false;
let inFlight: Promise<void> = Promise.resolve();
function work() {
  if (stopping || running) return;
  running = true;
  inFlight = tick().catch((error: unknown) => {
    reportError('Worker stopped after a storage or internal failure', error);
    process.exit(1);
  }).finally(() => { running = false; });
}
const timer = setInterval(work, 1000);
work();
async function shutdown() {
  if (stopping) return;
  stopping = true; clearInterval(timer);
  await Promise.all([inFlight, new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })]);
  process.exit(0);
}
function handleShutdown() {
  // Process signal listeners cannot await; explicitly surface any rejected shutdown.
  shutdown().catch((error: unknown) => { reportError('Shutdown failed', error); process.exit(1); });
}
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
server.on('error', (error) => { reportError('HTTP server failed', error); process.exit(1); });
