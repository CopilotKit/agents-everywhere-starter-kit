-- One person can hold more than one approver role (e.g. a small dev/test
-- setup where the same Slack user is seeded as approver, finance_lead and
-- owner) — the original UNIQUE on user_id assumed distinct people per
-- role, which isn't a real invariant the rest of the schema depends on.
--
-- Dropping the UNIQUE constraint requires dropping the foreign key built
-- on it first (approval_requests.assigned_approver_id -> approvers.user_id)
-- — that FK's own guarantee (every assignment points at a real approver)
-- is traded away for this; the plain, non-unique
-- approval_requests_assigned_approver_id_idx index is untouched.
ALTER TABLE approval_requests DROP CONSTRAINT approval_requests_assigned_approver_id_fkey;
ALTER TABLE approvers DROP CONSTRAINT approvers_user_id_key;
