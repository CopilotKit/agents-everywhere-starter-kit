import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { auth, requiredScopes } from 'express-oauth2-jwt-bearer';

// Tests use a local OIDC issuer with the same JWT verifier as the live recipe.
export function createApp({ issuer, audience, records = new Map() }) {
  const app = express();
  const checkJwt = auth({ issuerBaseURL: issuer, audience, tokenSigningAlg: 'RS256' });
  app.post('/followups', checkJwt, requiredScopes('create:followups'),
    express.json({ limit: '4kb' }), (req, res) => {
      const { incidentId, title } = req.body ?? {};
      if (typeof incidentId !== 'string' || !incidentId.trim() || incidentId.length > 80 ||
          typeof title !== 'string' || !title.trim() || title.length > 200) {
        return res.status(400).json({ error: 'Provide incidentId (1–80 characters) and title (1–200 characters).' });
      }
      const record = { id: randomUUID(), incidentId: incidentId.trim(), title: title.trim(),
        status: 'open', createdBy: req.auth.payload.sub, createdAt: new Date().toISOString() };
      records.set(record.id, record);
      res.status(201).json(record);
    });
  app.use((error, _req, res, _next) => {
    const status = [400, 401, 403, 413, 415].includes(error.status) ? error.status : 500;
    if (error.headers?.['WWW-Authenticate']) {
      res.set('WWW-Authenticate', error.headers['WWW-Authenticate']);
    }
    res.status(status).json({ error: {
      400: 'Invalid JSON body.', 401: 'A valid access token is required.',
      403: 'The create:followups permission is required.', 413: 'Request body is too large.',
      415: 'Unsupported request charset or content encoding.',
      500: 'Unable to create follow-up.',
    }[status] });
  });
  return app;
}

export function configuration(env, client = false) {
  for (const name of ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE',
    ...(client ? ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'] : [])]) {
    if (!env[name]?.trim()) throw new Error(`Set ${name} before running this example.`);
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(env.AUTH0_DOMAIN)) {
    throw new Error('AUTH0_DOMAIN must be a bare hostname, without https:// or a path.');
  }
  return { issuer: `https://${env.AUTH0_DOMAIN}/`, audience: env.AUTH0_AUDIENCE,
    clientId: env.AUTH0_CLIENT_ID, clientSecret: env.AUTH0_CLIENT_SECRET };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createApp(configuration(process.env)).listen(3101, '127.0.0.1', () => {
      console.log('Auth0 follow-up API: http://127.0.0.1:3101/followups');
    });
    server.on('error', () => { console.error('Unable to listen on 127.0.0.1:3101.'); process.exitCode = 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
