CREATE TABLE requisitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     TEXT NOT NULL, -- Slack user id
  status           TEXT NOT NULL CHECK (status IN (
                      'intake', 'rfq_dispatched', 'comparing',
                      'pending_approval', 'approved', 'rejected',
                      'po_issued', 'closed'
                    )),
  pending_question JSONB, -- nullable; { type, context, asked_at }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX requisitions_status_idx ON requisitions (status);
CREATE INDEX requisitions_requester_id_idx ON requisitions (requester_id);
