import { errors as joseErrors } from 'jose';
import { ZodError } from 'zod';

type ErrorCode =
  | 'AUTH0_CODE_EXCHANGE_FAILED' | 'AUTH0_CIBA_INITIATION_FAILED' | 'AUTH0_CIBA_TOKEN_EXCHANGE_FAILED'
  | 'AUTH0_INVALID_RESPONSE' | 'AUTH0_TRANSPORT_FAILED' | 'LOGIN_BINDING_MISMATCH' | 'LOGIN_EXPIRED'
  | 'APPROVAL_IDENTITY_MISMATCH' | 'APPROVAL_PERMISSION_MISSING' | 'APPROVAL_BINDING_MISMATCH'
  | 'UNEXPECTED_TOKEN_TYPE' | 'TWILIO_SEND_FAILED' | 'CUSTOMER_SERVICE_WINDOW_CLOSED';

/** Internal codes only: never attach upstream text, tokens, or user data. */
export class DiagnosticError extends Error {
  constructor(readonly code: ErrorCode, readonly httpStatus?: number) {
    super(code);
    this.name = 'DiagnosticError';
  }
}
const safeJoseCodes = new Set([
  'ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JOSE_ALG_NOT_ALLOWED', 'ERR_JWKS_NO_MATCHING_KEY', 'ERR_JWKS_TIMEOUT', 'ERR_JWS_INVALID', 'ERR_JWT_INVALID',
]);
export function reportError(operation: string, error: unknown) {
  const code = error instanceof DiagnosticError ? error.code
    : error instanceof joseErrors.JOSEError && safeJoseCodes.has(error.code) ? error.code
      : error instanceof ZodError ? 'VALIDATION_FAILED' : 'UNKNOWN_ERROR';
  const httpStatus = error instanceof DiagnosticError ? error.httpStatus : undefined;
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(), error: code,
    context: { operation, ...(httpStatus === undefined ? {} : { httpStatus }) },
  }));
}
