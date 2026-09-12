import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import { escapeHtml, html } from "./html";
import { mintInvitationToken, verifyInvitationToken } from "./magicLink";

const SECRET = "a".repeat(32);
const inAnHour = () => new Date(Date.now() + 3_600_000);

describe("magic links", () => {
  it("round-trips the invitation id", async () => {
    const token = await mintInvitationToken(SECRET, "inv-1", inAnHour());
    assert.deepEqual(await verifyInvitationToken(SECRET, token), { ok: true, invitationId: "inv-1" });
  });

  it("rejects a token signed with another secret or edited in transit", async () => {
    const token = await mintInvitationToken(SECRET, "inv-1", inAnHour());
    assert.deepEqual(await verifyInvitationToken("b".repeat(32), token), { ok: false, reason: "invalid" });
    const [header, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ invitation_id: "inv-2", exp: 9_999_999_999 })).toString("base64url");
    assert.deepEqual(await verifyInvitationToken(SECRET, `${header}.${forged}.${signature}`), {
      ok: false,
      reason: "invalid",
    });
    assert.ok(payload);
  });

  it("reports expiry separately so the portal can explain it", async () => {
    const token = await mintInvitationToken(SECRET, "inv-1", new Date(Date.now() - 60_000));
    assert.deepEqual(await verifyInvitationToken(SECRET, token), { ok: false, reason: "expired" });
  });

  it("rejects a validly signed token without an invitation id", async () => {
    const token = await new SignJWT({ other: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    assert.deepEqual(await verifyInvitationToken(SECRET, token), { ok: false, reason: "invalid" });
  });
});

describe("html", () => {
  it("escapes interpolations but not nested templates", () => {
    const name = `<script>alert("x")</script>`;
    const out = html`<p>${name}</p>${html`<b>${"&"}</b>`}${[html`<i>1</i>`, "<"]}`.value;
    assert.equal(out, `<p>${escapeHtml(name)}</p><b>&amp;</b><i>1</i>&lt;`);
  });
});
