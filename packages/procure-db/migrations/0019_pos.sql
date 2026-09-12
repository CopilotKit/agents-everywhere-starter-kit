-- One PO per (requisition, awarded supplier) — split award across
-- suppliers is supported.
CREATE TABLE pos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id),
  status         TEXT NOT NULL CHECK (status IN ('issued', 'closed')),
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pos_requisition_id_idx ON pos (requisition_id);
CREATE INDEX pos_supplier_id_idx ON pos (supplier_id);
