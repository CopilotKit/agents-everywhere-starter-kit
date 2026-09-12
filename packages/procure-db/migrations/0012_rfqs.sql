-- One row per requisition (not per category) — per-category invitee
-- shortlists are unioned into this one RFQ's invitations.
CREATE TABLE rfqs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL UNIQUE REFERENCES requisitions(id),
  dispatched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
