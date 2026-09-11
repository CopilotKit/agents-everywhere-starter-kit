import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Config } from './service.js';
import { ConfigurationError } from './diagnostics.js';

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && (url.pathname === '/' || url.pathname === '');
}, 'Use an HTTPS origin without a path, query, or credentials');
function readPlannerConfig(env: NodeJS.ProcessEnv): Pick<Config, 'modelProvider' | 'modelApiKey' | 'model'> {
  const selected = z.enum(['openai', 'openrouter']).default('openai').safeParse(env.MODEL_PROVIDER?.trim());
  if (!selected.success) throw new ConfigurationError(['MODEL_PROVIDER']);
  const modelProvider = selected.data;
  const keyField = modelProvider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
  const modelApiKey = env[keyField]?.trim();
  if (!modelApiKey) throw new ConfigurationError([keyField]);
  const modelField = env.MODEL !== undefined ? 'MODEL' : 'OPENAI_MODEL';
  let model = (env.MODEL ?? env.OPENAI_MODEL ?? 'gpt-4.1-mini').trim();
  if (modelProvider === 'openai') {
    model = model.replace(/^openai[/:]/, '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) throw new ConfigurationError([modelField]);
  } else {
    if (!model.includes('/')) model = `openai/${model}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) throw new ConfigurationError([modelField]);
  }
  return { modelProvider, modelApiKey, model };
}
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const planner = readPlannerConfig(env);
  const parsed = z.object({
    PUBLIC_BASE_URL: origin, AUTH0_ISSUER_BASE_URL: origin,
    AUTH0_CLIENT_ID: z.string().min(1), AUTH0_CLIENT_SECRET: z.string().min(1), AUTH0_AUDIENCE: z.string().min(1),
    WHATSAPP_ACCESS_TOKEN: z.string().min(1), WHATSAPP_PHONE_NUMBER_ID: z.string().regex(/^[0-9]+$/),
    WHATSAPP_APP_SECRET: z.string().min(1), WHATSAPP_VERIFY_TOKEN: z.string().min(1),
    WHATSAPP_CHANNEL_NAME: z.string().min(3).max(64).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).refine((value) => value !== 'channels', 'Reserved Channel name').default('whatsapp-demo'),
    WHATSAPP_API_VERSION: z.string().regex(/^v[0-9]+\.0$/).default('v23.0'),
    WHATSAPP_WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(3004),
    INTELLIGENCE_API_KEY: z.string().regex(/^cpk-[1-9][0-9]*_.+$/),
    PORT: z.coerce.number().int().min(1).max(65535).default(3003), DATA_FILE: z.string().min(1).optional(),
  }).safeParse(env);
  if (!parsed.success) throw new ConfigurationError([...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]);
  const value = parsed.data;
  if (value.PORT === value.WHATSAPP_WEBHOOK_PORT) throw new ConfigurationError(['PORT', 'WHATSAPP_WEBHOOK_PORT'], 'must be different');
  return {
    publicBaseUrl: new URL(value.PUBLIC_BASE_URL).origin, issuer: `${new URL(value.AUTH0_ISSUER_BASE_URL).origin}/`,
    clientId: value.AUTH0_CLIENT_ID, clientSecret: value.AUTH0_CLIENT_SECRET, audience: value.AUTH0_AUDIENCE,
    whatsappAccessToken: value.WHATSAPP_ACCESS_TOKEN, whatsappPhoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID,
    whatsappAppSecret: value.WHATSAPP_APP_SECRET, whatsappVerifyToken: value.WHATSAPP_VERIFY_TOKEN,
    whatsappWebhookPort: value.WHATSAPP_WEBHOOK_PORT, whatsappApiVersion: value.WHATSAPP_API_VERSION,
    channelName: value.WHATSAPP_CHANNEL_NAME, intelligenceApiKey: value.INTELLIGENCE_API_KEY,
    dataFile: value.DATA_FILE ? resolve(value.DATA_FILE) : fileURLToPath(new URL('../.data/state.json', import.meta.url)),
    ...planner, port: value.PORT,
  };
}
