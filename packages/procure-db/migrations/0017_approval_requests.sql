CREATE TABLE approval_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id       UUID NOT NULL REFERENCES requisitions(id),
  comparison_id        UUID REFERENCES comparisons(id), -- nullable until a decision is made
  amount_cents         INTEGER NOT NULL, -- snapshot of the amount used to resolve the tier
  current_tier         INTEGER NOT NULL,
  assigned_approver_id TEXT NOT NULL REFERENCES approvers(user_id),
  status                TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ
);

CREATE INDEX approval_requests_requisition_id_idx ON approval_requests (requisition_id);
CREATE INDEX approval_requests_assigned_approver_id_idx ON approval_requests (assigned_approver_id);
