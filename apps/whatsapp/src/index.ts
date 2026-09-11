import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { setTracingDisabled } from '@openai/agents';
import { readConfig } from './config.js';
import { reportError } from './diagnostics.js';

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
// Conversation text goes to the planner; disable separate trace/telemetry exports.
setTracingDisabled(true);
process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true';
const { createWhatsAppApp, closeServer } = await import('./runtime.js');

async function main() {
  const config = readConfig(process.env);
  // Bind the public port before starting Channels, so failure cannot leave its
  // internal listener running. Until initialization finishes, return unavailable.
  let ready = false;
  let service: Awaited<ReturnType<typeof createWhatsAppApp>> | undefined;
  const server = createServer((req, res) => {
    if (!ready || !service) { res.writeHead(503); res.end('Starting'); return; }
    service.app(req, res);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, '0.0.0.0', resolve); });
    service = await createWhatsAppApp(config);
    ready = true;
  } catch (error) {
    await closeServer(server);
    await service?.stop();
    throw error;
  }
  console.log(`WhatsApp agent listening on port ${config.port}. Health: /health. Webhook: ${config.publicBaseUrl}/webhooks/whatsapp`);
  let stopping = false;
  let running = false;
  let inFlight: Promise<void> = Promise.resolve();
  const work = () => {
    if (stopping || running) return;
    running = true;
    inFlight = service!.tick().catch((error: unknown) => {
      reportError('Worker failed', error);
      void shutdown(1);
    }).finally(() => { running = false; });
  };
  const timer = setInterval(work, 1000);
  async function shutdown(exitCode: number) {
    if (stopping) return;
    stopping = true; ready = false; clearInterval(timer);
    // Never leave sockets/worker alive indefinitely on teardown failure.
    const deadline = setTimeout(() => process.exit(1), 15_000);
    deadline.unref();
    try {
      await closeServer(server);
      await service!.stop();
      await inFlight;
      process.exit(exitCode);
    } catch (error) { reportError('Shutdown failed', error); process.exit(1); }
  }
  process.once('SIGTERM', () => { void shutdown(0); });
  process.once('SIGINT', () => { void shutdown(0); });
  server.on('error', (error) => { reportError('HTTP server failed', error); void shutdown(1); });
  work();
}
main().catch((error: unknown) => { reportError('Startup failed', error); process.exit(1); });
