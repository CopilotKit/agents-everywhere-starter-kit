CREATE TABLE po_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID NOT NULL REFERENCES pos(id),
  requisition_line_id   UUID NOT NULL REFERENCES requisition_lines(id),
  item_id               UUID NOT NULL REFERENCES items(id),
  awarded_quote_line_id UUID REFERENCES quote_lines(id), -- provenance: which quote line this was awarded from
  ordered_qty           NUMERIC(12,3) NOT NULL,
  unit_price_cents      INTEGER NOT NULL,
  total_price_cents     INTEGER NOT NULL
);

CREATE INDEX po_lines_po_id_idx ON po_lines (po_id);
CREATE INDEX po_lines_requisition_line_id_idx ON po_lines (requisition_line_id);
