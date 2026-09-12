CREATE TABLE thread_bindings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id     TEXT NOT NULL,
  thread_ts      TEXT NOT NULL,
  requisition_id UUID NOT NULL REFERENCES requisitions(id),
  surface        TEXT NOT NULL CHECK (surface IN ('channel_status', 'dm_conversation')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX thread_bindings_channel_thread_surface_idx
  ON thread_bindings (channel_id, thread_ts, surface);
-- Enforces the idempotent-upsert-by-requisition_id contract for the
-- dm_conversation row at the DB layer, not just application discipline.
CREATE UNIQUE INDEX thread_bindings_requisition_surface_idx
  ON thread_bindings (requisition_id, surface);
