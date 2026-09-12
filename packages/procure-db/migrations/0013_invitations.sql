-- No stored magic-link token column — the JWT carries only { invitation_id }
-- and is verified by signature, not looked up.
CREATE TABLE invitations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id         UUID NOT NULL REFERENCES rfqs(id),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id),
  status         TEXT NOT NULL CHECK (status IN ('sent', 'quoted', 'declined', 'no_response')),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL, -- 14-day JWT expiry; drives the no-response job
  decline_reason TEXT, -- required (app-enforced) when status='declined'
  responded_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX invitations_rfq_supplier_idx ON invitations (rfq_id, supplier_id);
CREATE INDEX invitations_supplier_id_idx ON invitations (supplier_id);
