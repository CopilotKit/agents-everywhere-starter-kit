-- Adds a status for an invitation whose RFQ notification email never went
-- out (missing supplier contact_info.email, SMTP failure, etc.) — distinct
-- from `sent` (issue 12's "fire-and-forget dispatched", independent of
-- delivery), so a failed send can be surfaced and retried rather than
-- silently counted as "awaiting quote" forever.
ALTER TABLE invitations DROP CONSTRAINT invitations_status_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_status_check
  CHECK (status IN ('sent', 'quoted', 'declined', 'no_response', 'send_failed'));

ALTER TABLE invitations ADD COLUMN send_error TEXT;
