-- Reporting layer for status questions ("has it been sent", "who's quoted",
-- "where's the hex bolt request"). One curated schema of read-only views
-- over the ~13 lifecycle tables, so a new question is a new query against
-- these views instead of a new narrow tool. Views only — `reporting` holds
-- no tables, so it's invisible to `test/migrate.test.ts`'s `public`-schema
-- table list.
--
-- Every child-table aggregate below is computed in its own keyed subquery
-- before being joined back to the parent grain — joining lines, invitations
-- and po_lines directly in one FROM would fan out and silently corrupt
-- every count/sum built on top of it.
CREATE SCHEMA reporting;

-- One row per requisition. Backs find_requests and is the header of
-- get_request. `waiting_on` is the actual lifecycle signal — requisitions
-- .status only reliably distinguishes 'intake' from everything else
-- ('comparing'/'approved'/'closed' are never written).
CREATE VIEW reporting.requisition_overview AS
WITH line_stats AS (
  SELECT
    requisition_id,
    count(*)::int AS line_count,
    count(*) FILTER (WHERE status = 'resolved')::int AS lines_resolved,
    count(*) FILTER (WHERE status = 'unresolved')::int AS lines_unresolved,
    count(*) FILTER (WHERE status = 'pending_resolution')::int AS lines_pending_resolution,
    count(*) FILTER (WHERE status = 'excluded')::int AS lines_excluded,
    string_agg(coalesce(i.name, rl.raw_description), ', ' ORDER BY rl.created_at) AS items_summary
  FROM requisition_lines rl
  LEFT JOIN items i ON i.id = rl.item_id
  GROUP BY rl.requisition_id
),
invitation_stats AS (
  SELECT
    rfqs.requisition_id,
    count(inv.id)::int AS suppliers_invited,
    count(*) FILTER (WHERE inv.status = 'quoted')::int AS suppliers_quoted,
    count(*) FILTER (WHERE inv.status = 'declined')::int AS suppliers_declined,
    count(*) FILTER (WHERE inv.status = 'no_response')::int AS suppliers_no_response,
    count(*) FILTER (WHERE inv.status = 'sent' AND inv.expires_at > now())::int AS suppliers_awaiting,
    min(inv.expires_at) FILTER (WHERE inv.status = 'sent' AND inv.expires_at > now()) AS next_quote_expiry
  FROM rfqs
  JOIN invitations inv ON inv.rfq_id = rfqs.id
  GROUP BY rfqs.requisition_id
),
quote_stats AS (
  SELECT
    rfqs.requisition_id,
    count(DISTINCT q.id)::int AS quotes_received,
    count(*) FILTER (WHERE ql.confidence = 'needs_review')::int AS quote_lines_needs_review
  FROM rfqs
  JOIN invitations inv ON inv.rfq_id = rfqs.id
  JOIN quotes q ON q.invitation_id = inv.id
  LEFT JOIN quote_lines ql ON ql.quote_id = q.id
  GROUP BY rfqs.requisition_id
),
latest_comparison AS (
  SELECT DISTINCT ON (requisition_id) requisition_id, version, generated_at
  FROM comparisons
  ORDER BY requisition_id, version DESC
),
latest_approval AS (
  SELECT DISTINCT ON (requisition_id)
    requisition_id, status, amount_cents, current_tier, assigned_approver_id
  FROM approval_requests
  ORDER BY requisition_id, created_at DESC
),
po_stats AS (
  SELECT
    pos.requisition_id,
    count(DISTINCT pos.id)::int AS po_count,
    sum(pol.total_price_cents) AS po_total_cents,
    count(*)::int AS po_line_count,
    count(*) FILTER (WHERE r.received_qty >= pol.ordered_qty)::int AS po_lines_fully_received,
    count(*) FILTER (WHERE iv.invoiced_qty >= pol.ordered_qty)::int AS po_lines_invoiced,
    count(*) FILTER (WHERE rc.reconciliation_status = 'has_discrepancies')::int AS po_lines_with_discrepancies
  FROM pos
  JOIN po_lines pol ON pol.po_id = pos.id
  LEFT JOIN LATERAL (
    SELECT sum(quantity_received) AS received_qty FROM receipts WHERE po_line_id = pol.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT sum(quantity_invoiced) AS invoiced_qty FROM invoices WHERE po_line_id = pol.id
  ) iv ON true
  LEFT JOIN LATERAL (
    SELECT reconciliation_status FROM reconciliations
    WHERE po_line_id = pol.id ORDER BY generated_at DESC LIMIT 1
  ) rc ON true
  GROUP BY pos.requisition_id
)
SELECT
  r.id AS requisition_id,
  r.requester_id,
  r.status,
  r.created_at,
  r.updated_at,
  r.pending_question ->> 'type' AS pending_question_type,
  CASE WHEN cb.channel_id IS NOT NULL THEN 'channel' ELSE 'dm' END AS origin,
  cb.channel_id AS origin_channel_id,
  coalesce(ls.line_count, 0) AS line_count,
  coalesce(ls.lines_resolved, 0) AS lines_resolved,
  coalesce(ls.lines_unresolved, 0) AS lines_unresolved,
  coalesce(ls.lines_pending_resolution, 0) AS lines_pending_resolution,
  coalesce(ls.lines_excluded, 0) AS lines_excluded,
  ls.items_summary,
  rfqs.dispatched_at AS rfq_dispatched_at,
  coalesce(inv.suppliers_invited, 0) AS suppliers_invited,
  coalesce(inv.suppliers_quoted, 0) AS suppliers_quoted,
  coalesce(inv.suppliers_declined, 0) AS suppliers_declined,
  coalesce(inv.suppliers_no_response, 0) AS suppliers_no_response,
  coalesce(inv.suppliers_awaiting, 0) AS suppliers_awaiting,
  inv.next_quote_expiry,
  coalesce(qs.quotes_received, 0) AS quotes_received,
  coalesce(qs.quote_lines_needs_review, 0) AS quote_lines_needs_review,
  lc.version AS latest_comparison_version,
  lc.generated_at AS latest_comparison_at,
  la.status AS approval_status,
  la.amount_cents AS approval_amount_cents,
  la.current_tier AS approval_tier,
  la.assigned_approver_id AS approval_assignee_id,
  coalesce(ps.po_count, 0) AS po_count,
  ps.po_total_cents,
  coalesce(ps.po_lines_fully_received, 0) AS po_lines_fully_received,
  coalesce(ps.po_lines_invoiced, 0) AS po_lines_invoiced,
  coalesce(ps.po_lines_with_discrepancies, 0) AS po_lines_with_discrepancies,
  coalesce(ps.po_line_count, 0) AS po_line_count,
  CASE
    WHEN rfqs.id IS NULL AND coalesce(ls.lines_pending_resolution, 0) > 0 THEN 'requester_choosing_items'
    WHEN rfqs.id IS NULL THEN 'requester_to_send'
    WHEN coalesce(qs.quotes_received, 0) = 0 AND coalesce(inv.suppliers_awaiting, 0) > 0 THEN 'supplier_quotes'
    WHEN coalesce(qs.quotes_received, 0) = 0 THEN 'no_quotes_received'
    WHEN la.status = 'pending' THEN 'approver'
    WHEN la.status = 'rejected' THEN 'rejected'
    WHEN ps.po_count IS NULL AND coalesce(inv.suppliers_awaiting, 0) > 0 THEN 'supplier_quotes'
    WHEN ps.po_count IS NULL THEN 'award_decision'
    WHEN coalesce(ps.po_lines_fully_received, 0) < coalesce(ps.po_line_count, 0) THEN 'delivery'
    WHEN coalesce(ps.po_lines_invoiced, 0) < coalesce(ps.po_line_count, 0) THEN 'invoice'
    WHEN coalesce(ps.po_lines_with_discrepancies, 0) > 0 THEN 'discrepancy_review'
    ELSE 'complete'
  END AS waiting_on
FROM requisitions r
LEFT JOIN line_stats ls ON ls.requisition_id = r.id
LEFT JOIN rfqs ON rfqs.requisition_id = r.id
LEFT JOIN invitation_stats inv ON inv.requisition_id = r.id
LEFT JOIN quote_stats qs ON qs.requisition_id = r.id
LEFT JOIN latest_comparison lc ON lc.requisition_id = r.id
LEFT JOIN latest_approval la ON la.requisition_id = r.id
LEFT JOIN po_stats ps ON ps.requisition_id = r.id
LEFT JOIN thread_bindings cb ON cb.requisition_id = r.id AND cb.surface = 'channel_status';

-- One row per requisition line.
CREATE VIEW reporting.requisition_line_detail AS
SELECT
  rl.requisition_id,
  rl.id AS line_id,
  rl.raw_description,
  rl.status AS line_status,
  rl.quantity_requested,
  rl.item_id,
  i.name AS item_name,
  i.sku,
  i.unit_of_measure,
  coalesce(rl.category, i.category) AS category,
  coalesce(qlc.quotes_received, 0) AS quotes_received,
  qlc.lowest_quoted_unit_price_cents,
  polc.ordered_qty,
  polc.awarded_suppliers,
  polc.received_qty,
  polc.invoiced_qty
FROM requisition_lines rl
LEFT JOIN items i ON i.id = rl.item_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS quotes_received,
    min(unit_price_cents) FILTER (WHERE unit_price_cents IS NOT NULL) AS lowest_quoted_unit_price_cents
  FROM quote_lines
  WHERE requisition_line_id = rl.id
) qlc ON true
LEFT JOIN LATERAL (
  SELECT
    sum(pol.ordered_qty) AS ordered_qty,
    string_agg(DISTINCT s.name, ', ') AS awarded_suppliers,
    sum(rc.received_qty) AS received_qty,
    sum(ivc.invoiced_qty) AS invoiced_qty
  FROM po_lines pol
  JOIN pos ON pos.id = pol.po_id
  JOIN suppliers s ON s.id = pos.supplier_id
  LEFT JOIN LATERAL (
    SELECT sum(quantity_received) AS received_qty FROM receipts WHERE po_line_id = pol.id
  ) rc ON true
  LEFT JOIN LATERAL (
    SELECT sum(quantity_invoiced) AS invoiced_qty FROM invoices WHERE po_line_id = pol.id
  ) ivc ON true
  WHERE pol.requisition_line_id = rl.id
) polc ON true;

-- One row per invitation.
CREATE VIEW reporting.supplier_responses AS
SELECT
  rfqs.requisition_id,
  inv.id AS invitation_id,
  inv.supplier_id,
  s.name AS supplier_name,
  inv.status AS invitation_status,
  inv.sent_at,
  inv.expires_at,
  inv.responded_at,
  inv.decline_reason,
  q.id AS quote_id,
  q.submitted_at AS quote_submitted_at,
  q.updated_at AS quote_updated_at,
  qlc.quoted_line_count,
  qlc.needs_review_line_count
FROM rfqs
JOIN invitations inv ON inv.rfq_id = rfqs.id
JOIN suppliers s ON s.id = inv.supplier_id
LEFT JOIN quotes q ON q.invitation_id = inv.id
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS quoted_line_count,
    count(*) FILTER (WHERE confidence = 'needs_review')::int AS needs_review_line_count
  FROM quote_lines
  WHERE quote_id = q.id
) qlc ON q.id IS NOT NULL;

-- One row per quote line.
CREATE VIEW reporting.quote_line_detail AS
SELECT
  rfqs.requisition_id,
  ql.requisition_line_id,
  coalesce(i.name, rl.raw_description) AS line_description,
  s.name AS supplier_name,
  ql.quantity_quoted,
  ql.unit,
  ql.unit_price_cents,
  ql.total_price_cents,
  ql.currency,
  ql.moq,
  ql.lead_time_days,
  ql.terms,
  ql.valid_until,
  ql.confidence,
  ql.flags,
  (ql.confidence = 'overridden') AS is_overridden,
  ql.override_reason
FROM quote_lines ql
JOIN requisition_lines rl ON rl.id = ql.requisition_line_id
LEFT JOIN items i ON i.id = rl.item_id
JOIN quotes q ON q.id = ql.quote_id
JOIN invitations inv ON inv.id = q.invitation_id
JOIN rfqs ON rfqs.id = inv.rfq_id
JOIN suppliers s ON s.id = inv.supplier_id;

-- One row per approval request.
CREATE VIEW reporting.approval_history AS
SELECT
  ar.requisition_id,
  ar.id AS approval_request_id,
  ar.amount_cents,
  ar.current_tier,
  ar.assigned_approver_id,
  a.role AS approver_role,
  ar.status,
  ar.created_at,
  ar.responded_at,
  c.version AS comparison_version,
  coalesce(esc.escalation_count, 0) AS escalation_count,
  esc.last_escalated_at
FROM approval_requests ar
LEFT JOIN approvers a ON a.user_id = ar.assigned_approver_id
LEFT JOIN comparisons c ON c.id = ar.comparison_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS escalation_count, max(escalated_at) AS last_escalated_at
  FROM escalations
  WHERE approval_request_id = ar.id
) esc ON true;

-- One row per PO line.
CREATE VIEW reporting.po_line_status AS
SELECT
  pos.requisition_id,
  pos.id AS po_id,
  s.name AS supplier_name,
  pos.status AS po_status,
  pos.issued_at,
  pol.requisition_line_id,
  i.name AS item_name,
  pol.ordered_qty,
  pol.unit_price_cents,
  pol.total_price_cents,
  rc_agg.received_qty,
  iv_agg.invoiced_qty,
  latest_rc.reconciliation_status AS latest_reconciliation_status,
  latest_rc.gaps AS latest_gaps,
  latest_rc.generated_at AS latest_reconciled_at
FROM po_lines pol
JOIN pos ON pos.id = pol.po_id
JOIN suppliers s ON s.id = pos.supplier_id
JOIN items i ON i.id = pol.item_id
LEFT JOIN LATERAL (
  SELECT sum(quantity_received) AS received_qty FROM receipts WHERE po_line_id = pol.id
) rc_agg ON true
LEFT JOIN LATERAL (
  SELECT sum(quantity_invoiced) AS invoiced_qty FROM invoices WHERE po_line_id = pol.id
) iv_agg ON true
LEFT JOIN LATERAL (
  SELECT reconciliation_status, gaps, generated_at
  FROM reconciliations
  WHERE po_line_id = pol.id
  ORDER BY generated_at DESC
  LIMIT 1
) latest_rc ON true;

-- One row per requisition that has at least one comparison — its latest version.
CREATE VIEW reporting.latest_comparison AS
SELECT DISTINCT ON (requisition_id)
  requisition_id, version, rationale_text, generated_at
FROM comparisons
ORDER BY requisition_id, version DESC;

-- Single source of truth for "which requisitions can this viewer see":
-- own + assigned-to-approve in a DM; channel-bound only in a channel.
-- Plain views can't take parameters, so this is a function. Both args NULL
-- returns nothing (fail closed).
CREATE FUNCTION reporting.visible_requisition_ids(p_user_id text, p_channel_id text)
RETURNS TABLE (requisition_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT tb.requisition_id
  FROM thread_bindings tb
  WHERE p_channel_id IS NOT NULL
    AND tb.surface = 'channel_status'
    AND tb.channel_id = p_channel_id

  UNION

  SELECT r.id
  FROM requisitions r
  WHERE p_channel_id IS NULL AND p_user_id IS NOT NULL
    AND r.requester_id = p_user_id

  UNION

  SELECT ar.requisition_id
  FROM approval_requests ar
  WHERE p_channel_id IS NULL AND p_user_id IS NOT NULL
    AND ar.assigned_approver_id = p_user_id;
$$;
