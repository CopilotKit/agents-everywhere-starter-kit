import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { DiagnosticError } from './diagnostics.js';
import type { Config } from './service.js';
import type { Identity } from './store.js';

export class Auth0 {
  private readonly keys;
  constructor(private readonly config: Config) {
    this.keys = createRemoteJWKSet(new URL('.well-known/jwks.json', config.issuer));
  }
  private async post(path: string, parameters: Record<string, string>) {
    const response = await fetch(new URL(path, this.config.issuer), {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...parameters }),
      signal: AbortSignal.timeout(10_000), redirect: 'error',
    }).catch(() => { throw new DiagnosticError('AUTH0_TRANSPORT_FAILED'); });
    const body: unknown = await response.json().catch(() => { throw new DiagnosticError('AUTH0_INVALID_RESPONSE', response.status); });
    return { ok: response.ok, status: response.status, body };
  }
  async exchange(code: string, verifier: string, nonce: string): Promise<Identity> {
    const result = await this.post('oauth/token', {
      grant_type: 'authorization_code', code, code_verifier: verifier,
      redirect_uri: `${this.config.publicBaseUrl}/auth/callback`,
    });
    if (!result.ok) throw new DiagnosticError('AUTH0_CODE_EXCHANGE_FAILED', result.status);
    const token = z.object({ id_token: z.string() }).parse(result.body);
    const { payload } = await jwtVerify(token.id_token, this.keys, {
      issuer: this.config.issuer, audience: this.config.clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    });
    if (payload.nonce !== nonce || (payload.azp !== undefined && payload.azp !== this.config.clientId)) throw new DiagnosticError('LOGIN_BINDING_MISMATCH');
    if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== this.config.clientId) throw new DiagnosticError('LOGIN_BINDING_MISMATCH');
    return { sub: z.string().min(1).parse(payload.sub), name: typeof payload.name === 'string' ? payload.name.slice(0, 100) : 'friend' };
  }
  async start(sub: string, bindingMessage: string) {
    const result = await this.post('bc-authorize', {
      login_hint: JSON.stringify({ format: 'iss_sub', iss: this.config.issuer, sub }),
      scope: 'openid create:requests', audience: this.config.audience,
      binding_message: bindingMessage, requested_expiry: '300',
    });
    if (!result.ok) throw new DiagnosticError('AUTH0_CIBA_INITIATION_FAILED', result.status);
    return z.object({ auth_req_id: z.string().min(1), expires_in: z.number().positive(), interval: z.number().positive().default(5) }).parse(result.body);
  }
  async poll(authReqId: string, expectedSub: string) {
    const result = await this.post('oauth/token', { grant_type: 'urn:openid:params:grant-type:ciba', auth_req_id: authReqId });
    if (!result.ok) {
      const failure = z.object({ error: z.string(), interval: z.number().positive().optional() }).safeParse(result.body);
      if (failure.success && ['authorization_pending', 'slow_down', 'access_denied', 'expired_token'].includes(failure.data.error)) return { kind: failure.data.error, interval: failure.data.interval };
      throw new DiagnosticError('AUTH0_CIBA_TOKEN_EXCHANGE_FAILED', result.status);
    }
    const token = z.object({ access_token: z.string(), token_type: z.string() }).parse(result.body);
    if (token.token_type.toLowerCase() !== 'bearer') throw new DiagnosticError('UNEXPECTED_TOKEN_TYPE');
    const { payload } = await jwtVerify(token.access_token, this.keys, {
      issuer: this.config.issuer, audience: this.config.audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'],
    });
    const client = payload.azp ?? payload.client_id;
    if (payload.sub !== expectedSub || client !== this.config.clientId) throw new DiagnosticError('APPROVAL_IDENTITY_MISMATCH');
    if (typeof payload.scope !== 'string' || !payload.scope.split(' ').includes('create:requests')) throw new DiagnosticError('APPROVAL_PERMISSION_MISSING');
    // The token is obtained only from this exact auth_req_id exchange. It is never accepted from a caller or reused.
    return { kind: 'approved' };
  }
}
