CREATE TABLE quotes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id    UUID NOT NULL UNIQUE REFERENCES invitations(id), -- 1:1
  content_hash     TEXT NOT NULL, -- sha256 of raw payload, the idempotency key
  raw_document_ref TEXT NOT NULL, -- Files API file_id / Docker volume path
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now() -- bumped on every edit-in-place
);
