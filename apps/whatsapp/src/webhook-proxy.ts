import express from 'express';
import { z } from 'zod';
import { DiagnosticError, reportError } from './diagnostics.js';
import type { Config } from './service.js';

const envelopeSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({ phone_number_id: z.string() }),
        contacts: z.array(z.object({ wa_id: z.string().optional(), profile: z.object({ name: z.string() }).optional() })).max(50).optional(),
        messages: z.array(z.object({
          from: z.string().regex(/^[1-9][0-9]{7,14}$/), id: z.string().regex(/^wamid\.[A-Za-z0-9+/=_-]+$/).max(512),
          type: z.string(), text: z.object({ body: z.string().min(1).max(4000) }).optional(),
        })).max(50).optional(),
        statuses: z.array(z.unknown()).max(100).optional(),
      }),
    })).max(20),
  })).max(20),
});

/** Forward raw bytes only at the public webhook path; OAuth stays on the main app. */
export function whatsappWebhookProxy(config: Config, report = reportError) {
  const router = express.Router();
  router.use('/webhooks/whatsapp', express.raw({ type: () => true, limit: '64kb', inflate: false }));
  router.all('/webhooks/whatsapp', async (req, res) => {
    if (req.path !== '/webhooks/whatsapp') { res.sendStatus(404); return; }
    if (!['GET', 'POST'].includes(req.method)) { res.sendStatus(405); return; }
    if (req.originalUrl.length > 2048) { res.sendStatus(414); return; }
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (req.method === 'POST') {
      let parsed: ReturnType<typeof envelopeSchema.safeParse>;
      try { parsed = envelopeSchema.safeParse(JSON.parse(raw.toString('utf8'))); }
      catch { res.status(400).type('text').send('Invalid WhatsApp envelope'); return; }
      if (!parsed.success) { res.status(400).type('text').send('Invalid WhatsApp envelope'); return; }
      const values = parsed.data.entry.flatMap((entry) => entry.changes.map((change) => change.value));
      if (values.some((value) => value.metadata.phone_number_id !== config.whatsappPhoneNumberId)) {
        res.status(403).type('text').send('Wrong WhatsApp destination'); return;
      }
      // The phone demo handles text only. Refuse media envelopes before the SDK can
      // download attachments. Status-only events still reach its real signature check.
      if (values.some((value) => value.messages?.some((message) => message.type !== 'text' || !message.text))) {
        res.status(400).type('text').send('This demo accepts text messages only'); return;
      }
    }
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    try {
      const response = await fetch(`http://127.0.0.1:${config.whatsappWebhookPort}/webhook${query}`, {
        method: req.method,
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': req.get('x-hub-signature-256') ?? '' },
        ...(req.method === 'POST' ? { body: new Uint8Array(raw) } : {}),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      // SDK responses are empty or a bounded GET challenge; never expose provider errors.
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      const reader = response.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > 8192) { await reader.cancel(); throw new DiagnosticError('WEBHOOK_PROXY_FAILED'); }
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
      }
      res.status(response.status).type('text').send(Buffer.concat(chunks).toString('utf8'));
    } catch {
      report('WhatsApp webhook forwarding failed', new DiagnosticError('WEBHOOK_PROXY_FAILED'));
      res.status(502).type('text').send('WhatsApp listener unavailable');
    }
  });
  router.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    res.status(status === 413 ? 413 : 400).type('text').send('Invalid webhook body');
  });
  return router;
}
