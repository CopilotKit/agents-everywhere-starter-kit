import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Config } from './service.js';

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && (url.pathname === '/' || url.pathname === '');
}, 'Use an HTTPS origin without a path, query, or credentials');
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = z.object({
    OPENAI_API_KEY: z.string().min(1), OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
    PUBLIC_BASE_URL: origin, AUTH0_ISSUER_BASE_URL: origin,
    AUTH0_CLIENT_ID: z.string().min(1), AUTH0_CLIENT_SECRET: z.string().min(1), AUTH0_AUDIENCE: z.string().min(1),
    TWILIO_ACCOUNT_SID: z.string().regex(/^AC[0-9a-fA-F]{32}$/), TWILIO_AUTH_TOKEN: z.string().min(1),
    TWILIO_WHATSAPP_FROM: z.string().regex(/^whatsapp:\+[1-9][0-9]{7,14}$/),
    PORT: z.coerce.number().int().min(1).max(65535).default(3003), DATA_FILE: z.string().min(1).optional(),
  }).safeParse(env);
  if (!parsed.success) throw new Error(`Invalid configuration: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const value = parsed.data;
  return {
    publicBaseUrl: new URL(value.PUBLIC_BASE_URL).origin, issuer: `${new URL(value.AUTH0_ISSUER_BASE_URL).origin}/`,
    clientId: value.AUTH0_CLIENT_ID, clientSecret: value.AUTH0_CLIENT_SECRET, audience: value.AUTH0_AUDIENCE,
    twilioAccountSid: value.TWILIO_ACCOUNT_SID, twilioAuthToken: value.TWILIO_AUTH_TOKEN, whatsappFrom: value.TWILIO_WHATSAPP_FROM,
    dataFile: value.DATA_FILE ? resolve(value.DATA_FILE) : fileURLToPath(new URL('../.data/state.json', import.meta.url)),
    model: value.OPENAI_MODEL, port: value.PORT,
  };
}
