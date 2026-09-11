import { createServer, type Server } from 'node:http';
import { CopilotRuntime, CopilotKitIntelligence } from '@copilotkit/runtime/v2';
import { createCopilotNodeListener } from '@copilotkit/runtime/v2/node';
import { createWhatsAppChannel } from './channels.js';
import { createService, type Config } from './service.js';
import { DiagnosticError } from './diagnostics.js';

/** Preflight catches occupied ports before the SDK's unguarded listen() call. */
export async function availableWebhookPort(port: number): Promise<number> {
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new DiagnosticError('LISTENER_PORT_UNAVAILABLE');
    return address.port;
  } catch { throw new DiagnosticError('LISTENER_PORT_UNAVAILABLE'); }
  finally { if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve())); }
}

export async function closeServer(server: Server) {
  if (!server.listening) return;
  server.closeIdleConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function createWhatsAppApp(config: Config, options: Omit<Parameters<typeof createService>[1], 'sendReply'> & {
  graphBaseUrl?: string;
  intelligenceUrls?: { apiUrl: string; wsUrl: string };
} = {}) {
  // SDK doesn't expose its bound ephemeral port. Tests request 0 here, then pass
  // the preflight's actual port to the adapter. Live configuration requires 1..65535.
  const whatsappWebhookPort = await availableWebhookPort(config.whatsappWebhookPort);
  const resolved = { ...config, whatsappWebhookPort };
  let receive: ReturnType<typeof createService>['receive'] | undefined;
  const transport = createWhatsAppChannel(resolved, (message) => {
    if (!receive) throw new DiagnosticError('CHANNELS_START_FAILED');
    receive(message);
  }, options);
  const service = createService(resolved, { ...options, sendReply: transport.sendReply });
  receive = service.receive;
  const runtime = new CopilotRuntime({
    agents: {}, channels: [transport.channel],
    intelligence: new CopilotKitIntelligence({ apiKey: config.intelligenceApiKey, ...options.intelligenceUrls }),
  });
  const listener = createCopilotNodeListener({ runtime, basePath: '/api/copilotkit' });
  try {
    await listener.channels.ready({ timeoutMs: 30_000 });
    const status = listener.channels.status().overall;
    // No managed Slack/Teams attachment is needed by this direct WhatsApp adapter.
    if (status !== 'online' && status !== 'setup_required') throw new DiagnosticError('CHANNELS_START_FAILED');
    const verification = new URL(`http://127.0.0.1:${whatsappWebhookPort}/webhook`);
    verification.search = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': config.whatsappVerifyToken, 'hub.challenge': 'ready' }).toString();
    const response = await fetch(verification, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok || await response.text() !== 'ready') throw new DiagnosticError('CHANNELS_START_FAILED');
  } catch {
    await listener.channels.stop();
    throw new DiagnosticError('CHANNELS_START_FAILED');
  }
  return { ...service, stop: () => listener.channels.stop(), channels: listener.channels, config: resolved };
}
