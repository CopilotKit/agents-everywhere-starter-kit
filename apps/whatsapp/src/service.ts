import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { Auth0 } from './auth0.js';
import { DiagnosticError, reportError } from './diagnostics.js';
import { createPlanner, proposalSchema, type PlannerInput, type Proposal } from './agent.js';
import { Store, type Approval } from './store.js';
import { whatsappWebhookProxy } from './webhook-proxy.js';
export type { Proposal } from './agent.js';
export type Config = {
  publicBaseUrl: string; issuer: string; clientId: string; clientSecret: string; audience: string;
  whatsappAccessToken: string; whatsappPhoneNumberId: string; whatsappAppSecret: string; whatsappVerifyToken: string;
  whatsappWebhookPort: number; whatsappApiVersion: string; channelName: string; intelligenceApiKey: string;
  dataFile: string; model: string; port: number;
};
const random = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const labelSchema = z.string().regex(/^[A-Za-z0-9_-]{1,24}$/);
const binding = (action: Approval) => `Save:${action.label}:#${action.id}`;
// Allowed labels and generated IDs cannot contain backticks. Channels preserves
// code spans verbatim, so WhatsApp displays the same literal values as Guardian.
const literal = (value: string) => `\`${value}\``;
const actionHash = (action: Pick<Approval, 'id' | 'from' | 'sub' | 'label'>) => hash(JSON.stringify([action.id, action.from, action.sub, action.label]));

export type IntakeMessage = { id: string; from: string; body: string };
export type SendReply = (from: string, body: string) => Promise<void>;
export function createService(config: Config, options: {
  sendReply: SendReply;
  planner?: (input: PlannerInput) => Promise<Proposal>; now?: () => number;
  reportError?: (operation: string, error: unknown) => void;
}) {
  const app = express();
  app.disable('x-powered-by');
  const store = new Store(config.dataFile, config.whatsappPhoneNumberId);
  const auth = new Auth0(config);
  const plan = options.planner ?? createPlanner(config.model);
  const now = options.now ?? Date.now;
  const report = options.reportError ?? reportError;
  let ticking = false;
  const reply = (from: string, body: string) => {
    store.data.outbox[random()] = { from, body, createdAt: now(), status: 'queued' };
  };
  app.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
    next();
  });
  app.use(whatsappWebhookProxy(config, report));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/', (_req, res) => res.type('text').send('WhatsApp + OpenAI Agents SDK + Auth0. Start by texting the configured Meta WhatsApp number.'));
  // Internal capability only. The Channels handler calls this after signed provider intake.
  const intakeSchema = z.object({
    id: z.string().regex(/^wamid\.[A-Za-z0-9+/=_-]+$/).max(512),
    from: z.string().regex(/^[1-9][0-9]{7,14}$/), body: z.string().min(1).max(4000),
  });
  function receive(message: IntakeMessage) {
    const { id, from, body } = intakeSchema.parse(message);
    if (store.data.inbox[id]) return;
    store.data.inbox[id] = { from, body: body.trim(), receivedAt: now(), status: 'queued' };
    store.save();
  }

  app.get('/link/:token', (req, res) => {
    const link = store.data.links[hash(req.params.token)];
    if (!link || link.expiresAt <= now() || link.phase !== 'new') { res.status(400).type('text').send('This link is used or expired. Text the bot again for a new link.'); return; }
    // WhatsApp link previews may GET this URL. Only an explicit form submission starts login.
    res.set('Content-Security-Policy', `default-src 'none'; form-action 'self' ${new URL(config.issuer).origin}; frame-ancestors 'none'`);
    res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect WhatsApp</title><h1>Connect your account</h1><p>Continue to Auth0, then send the displayed code from your WhatsApp conversation.</p><form method="post"><button type="submit">Continue with Auth0</button></form></html>');
  });
  app.post('/link/:token', (req, res) => {
    if (req.get('origin') !== config.publicBaseUrl) { res.status(403).type('text').send('Invalid login origin'); return; }
    const link = store.data.links[hash(req.params.token)];
    if (!link || link.expiresAt <= now() || link.phase !== 'new') { res.status(400).type('text').send('This link is used or expired. Text the bot again for a new link.'); return; }
    const browser = random();
    link.state = random(); link.nonce = random(); link.verifier = random(); link.browserHash = hash(browser); link.phase = 'login';
    store.save();
    const url = new URL('authorize', config.issuer);
    url.search = new URLSearchParams({
      client_id: config.clientId, response_type: 'code', scope: 'openid profile',
      redirect_uri: `${config.publicBaseUrl}/auth/callback`, state: link.state, nonce: link.nonce,
      code_challenge: createHash('sha256').update(link.verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'login',
    }).toString();
    res.setHeader('Set-Cookie', `wa_link=${browser}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600; Secure`);
    res.redirect(url.toString());
  });
  app.get('/auth/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const browser = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('wa_link='))?.slice(8) ?? '';
    const entry = Object.entries(store.data.links).find(([, item]) => item.state === state && item.phase === 'login');
    if (!entry || !code || !browser) { res.status(400).type('text').send('Invalid login session. Text the bot to start again.'); return; }
    const [key, link] = entry;
    if (link.expiresAt <= now() || !link.browserHash || !same(hash(browser), link.browserHash) || !link.verifier || !link.nonce) {
      res.status(400).type('text').send('Invalid or expired login session.'); return;
    }
    link.phase = 'exchanging'; store.save();
    try {
      const identity = await auth.exchange(code, link.verifier, link.nonce);
      if (link.expiresAt <= now()) throw new DiagnosticError('LOGIN_EXPIRED');
      const confirmation = randomBytes(8).toString('hex').toUpperCase();
      link.identity = identity; link.confirmationHash = hash(confirmation); link.phase = 'confirm';
      delete link.verifier; delete link.nonce; delete link.browserHash; delete link.state;
      store.save();
      res.setHeader('Set-Cookie', 'wa_link=; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
      res.type('text').send(`Signed in as ${identity.name}. To connect this account, send the following from the original WhatsApp conversation:\n\nLINK ${confirmation}\n\nThis expires in 10 minutes from the initial link. Only send it if you started this login. Never share this code.`);
    } catch (error) {
      delete store.data.links[key]; store.save(); report('Account linking failed', error);
      res.status(400).type('text').send('Sign-in could not be verified. Text the bot to start again.');
    }
  });

  async function processMessage(item: Store['data']['inbox'][string]) {
    const { from, body } = item;
    const identity = store.data.identities[from];
    if (!identity) {
      const match = /^LINK ([A-F0-9]{16})$/i.exec(body);
      if (match) {
        const entry = Object.entries(store.data.links).find(([, link]) => link.from === from && link.phase === 'confirm' && link.expiresAt > now() && link.confirmationHash === hash(match[1].toUpperCase()));
        if (!entry?.[1].identity) { reply(from, 'That linking code is invalid or expired. Text hello to sign in again.'); return; }
        if (Object.values(store.data.identities).some((person) => person.sub === entry[1].identity!.sub)) {
          reply(from, 'This Auth0 account is already linked to another WhatsApp sender. Ask the demo operator to reset the link.'); return;
        }
        store.data.identities[from] = entry[1].identity;
        for (const [key, link] of Object.entries(store.data.links)) if (link.from === from) delete store.data.links[key];
        reply(from, `Connected as ${entry[1].identity.name}. Try: Save a request called team-lunch. I will ask for approval in Auth0 Guardian. Text STATUS to see outcomes.`);
      } else {
        for (const [key, link] of Object.entries(store.data.links)) if (link.from === from || link.expiresAt <= now()) delete store.data.links[key];
        const token = random();
        store.data.links[hash(token)] = { from, expiresAt: now() + 600_000, phase: 'new' };
        reply(from, `First connect your account with Auth0: ${config.publicBaseUrl}/link/${token}\nAfter signing in, send the displayed LINK code here. The link expires in 10 minutes.`);
      }
      return;
    }
    const actions = Object.values(store.data.approvals).filter((action) => action.from === from).sort((a, b) => b.createdAt - a.createdAt);
    if (body.toUpperCase() === 'STATUS') {
      const lines = actions.slice(0, 5).map((action) => literal(`${action.id}: ${action.label} — ${action.status}`));
      reply(from, `Connected as ${identity.name}.\n${lines.length ? lines.join('\n') : 'No requests yet.'}`); return;
    }
    if (actions.some((action) => ['pending', 'initiating'].includes(action.status))) {
      reply(from, 'A request is awaiting your response in Auth0 Guardian. Approve or deny it there, or let it expire. Text STATUS to check it.'); return;
    }
    const history = store.data.history[from] ?? [];
    const proposal = proposalSchema.parse(await plan({ identity, text: body, history }));
    if (proposal.requestLabel !== null) {
      const label = labelSchema.parse(proposal.requestLabel);
      if (actions.some((action) => action.createdAt > now() - 60_000)) { reply(from, 'Please wait one minute between phone approval requests. Text STATUS for the latest result.'); return; }
      const action: Approval = {
        id: randomBytes(6).toString('hex').toUpperCase(), from, sub: identity.sub, label, actionHash: '',
        status: 'initiating', createdAt: now(), expiresAt: now() + 300_000, nextPollAt: now(), interval: 5,
      };
      action.actionHash = actionHash(action);
      store.data.approvals[action.id] = action;
      store.save(); // Persist intent before an external approval request; an interrupted initiation is never repeated.
      try {
        const start = await auth.start(identity.sub, binding(action));
        action.authReqId = start.auth_req_id; action.status = 'pending';
        action.expiresAt = Math.min(action.expiresAt, now() + start.expires_in * 1000);
        action.interval = Math.max(5, start.interval); action.nextPollAt = now() + action.interval * 1000;
        reply(from, `Approve saving the local demo request ${literal(label)} in Auth0 Guardian. Match this exact message:\n${literal(binding(action))}\nNo record is saved until approval. This expires within 5 minutes. You may deny it on your phone.`);
      } catch (error) {
        action.status = 'failed'; report('Approval initiation failed', error);
        reply(from, `Approval for ${action.id} could not be started. Nothing was saved. Check Auth0 CIBA configuration and Guardian enrollment, then try again.`);
      }
    } else {
      reply(from, proposal.reply);
    }
    store.data.history[from] = [...history, { role: 'user' as const, content: body }, { role: 'assistant' as const, content: proposal.requestLabel ? `Proposed local demo request ${proposal.requestLabel}; phone approval is required.` : proposal.reply }].slice(-16);
  }

  async function poll(action: Approval) {
    if (action.status !== 'pending') return;
    if (action.expiresAt <= now()) { action.status = 'expired'; reply(action.from, `Request ${action.id} expired. Nothing was saved. Send a new request to try again.`); return; }
    if (action.nextPollAt > now()) return;
    try {
      if (!action.authReqId || action.actionHash !== actionHash(action) || store.data.identities[action.from]?.sub !== action.sub) throw new DiagnosticError('APPROVAL_BINDING_MISMATCH');
      action.nextPollAt = now() + action.interval * 1000; store.save();
      const result = await auth.poll(action.authReqId, action.sub);
      if (result.kind === 'authorization_pending') return;
      if (result.kind === 'slow_down') {
        action.interval = Math.max(action.interval + 5, result.interval ?? 0); action.nextPollAt = now() + action.interval * 1000; return;
      }
      if (result.kind === 'access_denied' || result.kind === 'expired_token') {
        action.status = result.kind === 'access_denied' ? 'denied' : 'expired';
        reply(action.from, `Request ${action.id} ${action.status}. Nothing was saved.`); return;
      }
      if (result.kind !== 'approved' || action.expiresAt <= now()) {
        action.status = 'expired'; reply(action.from, `Request ${action.id} expired before execution. Nothing was saved.`); return;
      }
      // The only privileged action. Atomic with the consumed approval and result notification.
      labelSchema.parse(action.label);
      store.data.records[action.id] = { id: action.id, sub: action.sub, label: action.label, createdAt: now() };
      action.status = 'saved';
      reply(action.from, `Saved request ${literal(action.label)} with ID ${action.id}, after your Auth0 approval. This is a local demo record; no external purchase or booking was made.`);
    } catch (error) {
      action.status = 'failed'; report('Approval verification failed', error);
      reply(action.from, `Request ${action.id} failed verification. Nothing was saved. Check the app log and Auth0 API permission, then send a new request.`);
    }
  }

  async function sendOutbox() {
    for (const message of Object.values(store.data.outbox)) {
      if (message.status !== 'queued') continue;
      const recent = Object.values(store.data.inbox).some((item) => item.from === message.from && item.receivedAt > now() - 24 * 60 * 60 * 1000);
      if (!recent) { message.status = 'failed'; store.save(); report('WhatsApp reply skipped', new DiagnosticError('CUSTOMER_SERVICE_WINDOW_CLOSED')); continue; }
      message.status = 'sending'; store.save();
      try {
        await options.sendReply(message.from, message.body);
        message.status = 'sent';
      } catch (error) {
        message.status = 'failed'; report('WhatsApp reply failed; send STATUS to recover', error);
      }
      store.save();
    }
  }
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      for (const item of Object.values(store.data.inbox)) {
        if (item.status !== 'queued') continue;
        item.status = 'processing'; store.save();
        try { await processMessage(item); item.status = 'done'; }
        catch (error) { item.status = 'failed'; report('Message processing failed', error); reply(item.from, 'I could not process that message. Nothing new was executed. Text STATUS to check requests, then try again.'); }
        store.save();
      }
      for (const action of Object.values(store.data.approvals)) { await poll(action); store.save(); }
      await sendOutbox();
    } finally { ticking = false; }
  }
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    report('HTTP request failed', error); res.status(500).type('text').send('Request failed');
  });
  return { app, store, tick, receive };
}
