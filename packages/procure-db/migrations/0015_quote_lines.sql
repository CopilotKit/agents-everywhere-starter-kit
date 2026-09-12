-- Replaced wholesale (delete+reinsert, or upsert by (quote_id,
-- requisition_line_id)) on every quote edit; quotes.content_hash/updated_at
-- tracks the edit event itself.
CREATE TABLE quote_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            UUID NOT NULL REFERENCES quotes(id),
  requisition_line_id UUID NOT NULL REFERENCES requisition_lines(id),
  quantity_quoted     NUMERIC(12,3) NOT NULL, -- pack/lot size as stated, unreconciled
  unit                TEXT NOT NULL, -- as stated ("box", "pallet")
  unit_price_cents    INTEGER, -- nullable; normalized to item-master unit
  total_price_cents   INTEGER,
  currency            TEXT NOT NULL DEFAULT 'USD',
  moq                 NUMERIC(12,3),
  lead_time_days      INTEGER,
  terms               TEXT, -- free text, not enumerated
  valid_until         DATE,
  confidence          TEXT NOT NULL CHECK (confidence IN ('confident', 'needs_review', 'overridden')),
  flags               JSONB NOT NULL DEFAULT '[]', -- [{ field, reason }]
  override_reason     TEXT,
  overridden_by       TEXT, -- Slack user id
  overridden_at       TIMESTAMPTZ
);

CREATE INDEX quote_lines_quote_id_idx ON quote_lines (quote_id);
CREATE INDEX quote_lines_requisition_line_id_idx ON quote_lines (requisition_line_id);
