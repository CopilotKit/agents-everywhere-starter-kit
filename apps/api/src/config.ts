export interface ApiConfig {
  jwtSecret: string;
  /** Origin that serves /portal (the Vite dev server proxies it to this api). */
  portalBaseUrl: string;
  uploadsDir: string;
  smtp: { host: string; port: number; user?: string; pass?: string; from: string };
  redisUrl: string;
  port: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to the root .env (see .env.example).`);
  return value;
}

export function loadConfig(): ApiConfig {
  const jwtSecret = required("JWT_SIGNING_SECRET");
  if (jwtSecret.length < 32) throw new Error("JWT_SIGNING_SECRET must be at least 32 characters.");
  return {
    jwtSecret,
    portalBaseUrl: required("PORTAL_BASE_URL").replace(/\/+$/, ""),
    uploadsDir: process.env.QUOTE_UPLOADS_DIR || ".data/quote-uploads",
    smtp: {
      host: required("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      from: required("SMTP_FROM"),
    },
    redisUrl: required("REDIS_URL"),
    port: Number(process.env.API_PORT || 3001),
  };
}
