-- Approval requests are now raised by an explicit in-channel supplier
-- selection (a "Select <Supplier>" click on a posted comparison) rather
-- than automatically off the cheapest-per-line total across every quote.
-- `selected_quote_id` is what actually gets approved/awarded —
-- `issuePurchaseOrders` filters to this one quote's lines instead of the
-- old cheapest-per-line-across-all-quotes selection. `selected_by` is the
-- Slack user id who clicked, recorded for the approver's context.
ALTER TABLE approval_requests ADD COLUMN selected_quote_id UUID REFERENCES quotes(id);
ALTER TABLE approval_requests ADD COLUMN selected_by TEXT;
