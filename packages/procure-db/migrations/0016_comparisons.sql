-- Never UPDATEd/DELETEd — enforced as an application convention, not DB
-- lockdown.
CREATE TABLE comparisons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id),
  version        INTEGER NOT NULL,
  quote_lines    JSONB NOT NULL, -- full raw quote_lines rows as they stood at generation
  rationale_text TEXT NOT NULL,
  model_id       TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin_context JSONB NOT NULL -- { type: "dm"|"channel_thread", channel_id, thread_ts, user_id }
);

CREATE UNIQUE INDEX comparisons_requisition_version_idx ON comparisons (requisition_id, version);
