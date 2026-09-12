-- Issue 30/13: backstops "one pending approval_request per requisition at a
-- time" at the DB level. `requestApprovalIfNeeded`'s check-then-insert is
-- not itself atomic, so two near-simultaneous quote_submitted runs for the
-- same requisition could otherwise both pass the pending-check before
-- either inserts — this index makes the second insert fail loudly instead
-- of silently producing two concurrent pending requests.
CREATE UNIQUE INDEX approval_requests_one_pending_idx
  ON approval_requests (requisition_id)
  WHERE status = 'pending';
