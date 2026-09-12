CREATE TABLE unresolved_item_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_line_id  UUID NOT NULL REFERENCES requisition_lines(id),
  description_text     TEXT NOT NULL,
  requester_id         TEXT NOT NULL,
  best_candidate_id    UUID REFERENCES items(id),
  best_candidate_score NUMERIC(4,3),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX unresolved_item_requests_requisition_line_id_idx
  ON unresolved_item_requests (requisition_line_id);
