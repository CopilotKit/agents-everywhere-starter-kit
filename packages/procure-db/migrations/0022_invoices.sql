CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_id        UUID REFERENCES po_lines(id), -- nullable: unresolved -> unexpected_item
  item_id           UUID REFERENCES items(id), -- nullable: resolve_item no-match
  quantity_invoiced NUMERIC(12,3) NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  invoiced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_ref      TEXT NOT NULL
);

CREATE INDEX invoices_po_line_id_idx ON invoices (po_line_id);
