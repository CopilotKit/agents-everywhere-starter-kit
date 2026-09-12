import { errors, jwtVerify, SignJWT } from "jose";

const key = (secret: string) => new TextEncoder().encode(secret);

export async function mintInvitationToken(secret: string, invitationId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ invitation_id: invitationId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key(secret));
}

export type TokenCheck = { ok: true; invitationId: string } | { ok: false; reason: "expired" | "invalid" };

export async function verifyInvitationToken(secret: string, token: string): Promise<TokenCheck> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const invitationId = payload.invitation_id;
    if (typeof invitationId !== "string") return { ok: false, reason: "invalid" };
    return { ok: true, invitationId };
  } catch (error) {
    return { ok: false, reason: error instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}
