-- Backstops issue 28's "one canonical quote_lines row per (quote,
-- requisition line) pair" invariant at the DB level — a duplicate insert
-- (e.g. Claude's extraction matching two quote line items to the same
-- requested item) fails loudly instead of silently producing two rows for
-- the same pair.
CREATE UNIQUE INDEX quote_lines_quote_id_requisition_line_id_idx
  ON quote_lines (quote_id, requisition_line_id);
