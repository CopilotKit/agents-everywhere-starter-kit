-- Append-only — never updated.
CREATE TABLE reconciliations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_id               UUID REFERENCES po_lines(id), -- nullable for unexpected_item
  triggered_by             TEXT NOT NULL CHECK (triggered_by IN ('receipt', 'invoice')),
  -- receipts.id or invoices.id depending on triggered_by (polymorphic —
  -- no FK constraint possible across two target tables); UNIQUE is what
  -- actually provides the retry-safety guarantee, not referential integrity.
  triggering_event_id      UUID NOT NULL UNIQUE,
  ordered_qty              NUMERIC(12,3),
  received_qty             NUMERIC(12,3) NOT NULL,
  invoiced_qty             NUMERIC(12,3),
  po_unit_price_cents      INTEGER,
  invoice_unit_price_cents INTEGER,
  gaps                     JSONB NOT NULL DEFAULT '[]', -- [{ type, delta }]
  reconciliation_status    TEXT NOT NULL CHECK (reconciliation_status IN ('clean', 'has_discrepancies')),
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reconciliations_po_line_id_idx ON reconciliations (po_line_id);
