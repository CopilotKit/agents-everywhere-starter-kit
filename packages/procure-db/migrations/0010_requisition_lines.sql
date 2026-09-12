CREATE TABLE requisition_lines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id     UUID NOT NULL REFERENCES requisitions(id),
  raw_description    TEXT NOT NULL,
  item_id            UUID REFERENCES items(id), -- nullable: no-match
  quantity_requested NUMERIC(12,3) NOT NULL,
  category           TEXT, -- denormalized from items.category at resolution
  status             TEXT NOT NULL CHECK (status IN (
                        'pending_resolution', 'resolved', 'unresolved', 'excluded'
                      )),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX requisition_lines_requisition_id_idx ON requisition_lines (requisition_id);
CREATE INDEX requisition_lines_item_id_idx ON requisition_lines (item_id);
