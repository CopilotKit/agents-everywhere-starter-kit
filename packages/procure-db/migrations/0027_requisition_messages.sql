-- The intake agent's conversation memory: every requester message and every
-- bot reply for a requisition, so each turn is interpreted against what was
-- already said ("yes, that one", "make it 3") rather than in isolation.
-- Rehydrated from Postgres per run, never from the Slack transcript (issue 13).
CREATE TABLE requisition_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id),
  role           TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content        TEXT NOT NULL,
  slack_ts       TEXT, -- the requester's Slack message ts; NULL for bot replies
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX requisition_messages_requisition_id_idx
  ON requisition_messages (requisition_id, created_at);
-- A retried intake job re-appends the same inbound message — this makes that
-- append a no-op instead of a duplicate turn in the agent's history.
CREATE UNIQUE INDEX requisition_messages_requisition_slack_ts_idx
  ON requisition_messages (requisition_id, slack_ts)
  WHERE slack_ts IS NOT NULL;
