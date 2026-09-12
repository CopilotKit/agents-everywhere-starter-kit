CREATE TABLE receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_id        UUID NOT NULL REFERENCES po_lines(id),
  item_id           UUID NOT NULL REFERENCES items(id),
  quantity_received NUMERIC(12,3) NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_ref      TEXT NOT NULL -- Files API file_id
);

CREATE INDEX receipts_po_line_id_idx ON receipts (po_line_id);
