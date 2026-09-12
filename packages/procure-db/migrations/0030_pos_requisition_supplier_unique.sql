-- PO issuance now runs as its own retryable BullMQ run (issue: error
-- surfacing 05) rather than inline on the approval-click handler, so a
-- retried attempt must not double-issue a PO for a supplier that a prior
-- attempt already issued one for.
CREATE UNIQUE INDEX pos_requisition_supplier_idx ON pos (requisition_id, supplier_id);
