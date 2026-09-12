CREATE TABLE escalations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id),
  from_tier           INTEGER NOT NULL,
  to_tier             INTEGER NOT NULL,
  escalated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX escalations_approval_request_id_idx ON escalations (approval_request_id);
