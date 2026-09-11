import { createChannel, renderToIR } from '@copilotkit/channels';
import { whatsapp, WhatsAppClient } from '@copilotkit/channels/whatsapp';
import { DiagnosticError, reportError } from './diagnostics.js';
import type { Config, IntakeMessage, SendReply } from './service.js';

/** Only code-level test fixtures can redirect the provider. Live env cannot override Graph. */
export function createWhatsAppChannel(config: Config, receive: (message: IntakeMessage) => void, options: {
  graphBaseUrl?: string;
  reportError?: typeof reportError;
} = {}) {
  const report = options.reportError ?? reportError;
  const clientOptions = {
    accessToken: config.whatsappAccessToken, phoneNumberId: config.whatsappPhoneNumberId,
    apiVersion: config.whatsappApiVersion, graphBaseUrl: options.graphBaseUrl,
  };
  const adapter = whatsapp({
    ...clientOptions, appSecret: config.whatsappAppSecret, verifyToken: config.whatsappVerifyToken,
    port: config.whatsappWebhookPort, path: '/webhook',
    // This app has text commands (LINK/STATUS), not SDK slash-command handlers.
    commandPrefix: '\u0000',
  });
  // Public client injection preserves the SDK's rendering/Graph implementation.
  // Its default read-receipt logger includes provider response bodies on failure.
  // Bound requests and replace unsafe provider errors before they reach that logger.
  adapter.client = new WhatsAppClient({
    ...clientOptions,
    fetchImpl: async (input, init) => {
      try {
        const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
          await response.body?.cancel();
          throw new DiagnosticError('META_SEND_FAILED', response.status);
        }
        return response;
      } catch (error) {
        if (error instanceof DiagnosticError) throw error;
        throw new DiagnosticError('META_TRANSPORT_FAILED');
      }
    },
  });
  const channel = createChannel({ name: config.channelName, identifyUser: 'platform', adapters: [adapter] });
  channel.onMessage(async ({ message }) => {
    try {
      receive({ id: message.operation.logicalMessageId, from: message.actor.id, body: message.text });
    } catch (error) {
      // SDK dispatch occurs after its ACK. A failed persistence cannot trigger Meta retry.
      report('Channels intake failed after provider acknowledgment', error);
    }
  });
  const sendReply: SendReply = async (from, body) => {
    // The SDK treats plain text as Markdown. Percent encoding keeps underscore
    // URL tokens literal and clickable, including links already in the outbox.
    const linkSafeBody = body.replace(/https?:\/\/[^\s`]+/g, (url) => url.replaceAll('_', '%5F'));
    const ref = await adapter.post({ to: from, phoneNumberId: config.whatsappPhoneNumberId }, renderToIR(linkSafeBody));
    if (!ref.id) throw new DiagnosticError('META_INVALID_RESPONSE');
  };
  return { channel, sendReply };
}
