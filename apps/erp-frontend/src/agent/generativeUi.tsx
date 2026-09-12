import { useComponent, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { awardQuote, dispatchRfq, fetchComparison, fetchRfqPreview } from "../api/client";
import { ComparisonTable } from "../components";
import { formatCents, formatDay, formatQty } from "../format";
import { useApi, useRefreshData } from "../useApi";

// Approval cards fetch what they show from the api using only the ids the
// agent passed, so suppliers and prices on screen are the database's, not the
// model's. The write happens here, on the requester's click, never in a tool.

interface HitlProps<T> {
  args: Partial<T>;
  result?: string;
  respond?: (result: unknown) => Promise<void>;
}

type Outcome = { outcome: string; [key: string]: unknown };

function parseOutcome(result: string | undefined): Outcome | null {
  if (!result) return null;
  try {
    return JSON.parse(result) as Outcome;
  } catch {
    return { outcome: "unknown", message: result };
  }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Request failed");

function useDecision() {
  const [busy, setBusy] = useState(false);
  const run = async (respond: HitlProps<unknown>["respond"], action: () => Promise<Outcome>) => {
    if (!respond || busy) return;
    setBusy(true);
    let outcome: Outcome;
    try {
      outcome = await action();
    } catch (error) {
      outcome = { outcome: "error", error: errorMessage(error), note: "Nothing may have been sent. Report this error to the requester; do not retry on your own." };
    }
    await respond(JSON.stringify(outcome));
  };
  return { busy, run };
}

function QuoteComparisonCard({ requisitionId }: { requisitionId?: string }) {
  const state = useApi(
    () => (requisitionId ? fetchComparison(requisitionId) : Promise.resolve(null)),
    `card-comparison:${requisitionId ?? ""}`,
  );
  return (
    <article className="agent-card">
      <header className="agent-card__eyebrow">Quote comparison</header>
      {state.error && <p role="alert">{state.error}</p>}
      {!state.data && !state.error && <p className="state-line">Loading quotes…</p>}
      {state.data && <ComparisonTable comparison={state.data} compact />}
      {requisitionId && (
        <Link className="crumb-inline" to={`/requisitions/${requisitionId}`}>
          Open requisition →
        </Link>
      )}
    </article>
  );
}

function RfqApprovalCard({ args, result, respond }: HitlProps<{ requisitionId: string }>) {
  const refresh = useRefreshData();
  const { busy, run } = useDecision();
  const preview = useApi(
    () => (args.requisitionId ? fetchRfqPreview(args.requisitionId) : Promise.resolve(null)),
    `card-rfq:${args.requisitionId ?? ""}`,
  );
  const outcome = parseOutcome(result);

  if (outcome) {
    const invitations = (outcome.invitations as { supplierName: string; status: string; error: string | null }[]) ?? [];
    return (
      <article className="agent-card">
        <header className="agent-card__eyebrow">Request for quotation</header>
        {outcome.outcome === "sent" && (
          <>
            <p className="agent-card__done">RFQ emailed.</p>
            <ul className="agent-card__list">
              {invitations.map((invitation) => (
                <li key={invitation.supplierName}>
                  <span className={`lamp lamp--${invitation.status === "sent" ? "positive" : "negative"}`}>{invitation.status}</span>{" "}
                  {invitation.supplierName}
                  {invitation.error ? ` — ${invitation.error}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
        {outcome.outcome === "cancelled" && <p className="agent-card__done">Cancelled. Nothing was sent.</p>}
        {outcome.outcome === "error" && <p role="alert">{String(outcome.error)}</p>}
      </article>
    );
  }

  if (!respond || !preview.data) {
    return (
      <article className="agent-card">
        <header className="agent-card__eyebrow">Request for quotation</header>
        {preview.error ? <p role="alert">{preview.error}</p> : <p className="state-line">Preparing the RFQ…</p>}
      </article>
    );
  }

  const { requisition, invitees } = preview.data;
  const alreadySent = requisition.status !== "intake";
  return (
    <article className="agent-card agent-card--gate">
      <header className="agent-card__eyebrow">Approve request for quotation</header>
      <ul className="agent-card__list">
        {requisition.lines.map((line) => (
          <li key={line.id}>
            <strong>{formatQty(line.quantityRequested, line.unitOfMeasure)}</strong> {line.itemName}{" "}
            <span className="mono">{line.sku}</span>
          </li>
        ))}
      </ul>
      <p>Needed by {formatDay(requisition.neededBy)}. Email a quote link to:</p>
      <ul className="agent-card__list">
        {invitees.map((supplier) => (
          <li key={supplier.id}>
            {supplier.name}
            {supplier.preferred ? " (preferred)" : ""} <span className="mono">{supplier.email ?? "no email"}</span>
          </li>
        ))}
      </ul>
      {alreadySent && <p role="alert">RFQs were already sent for this request.</p>}
      <div className="agent-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || alreadySent || invitees.length === 0}
          onClick={() =>
            run(respond, async () => {
              const dispatched = await dispatchRfq(requisition.id);
              refresh();
              return { outcome: "sent", requisitionId: requisition.id, invitations: dispatched.invitations };
            })
          }
        >
          {busy ? "Sending…" : `Send RFQs to ${invitees.length} suppliers`}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            run(respond, async () => ({
              outcome: "cancelled",
              note: "The requester cancelled. No emails were sent; the requisition stays a draft.",
            }))
          }
        >
          Cancel
        </button>
      </div>
    </article>
  );
}

function AwardApprovalCard({ args, result, respond }: HitlProps<{ requisitionId: string; quoteId: string }>) {
  const refresh = useRefreshData();
  const { busy, run } = useDecision();
  const comparison = useApi(
    () => (args.requisitionId ? fetchComparison(args.requisitionId) : Promise.resolve(null)),
    `card-award:${args.requisitionId ?? ""}`,
  );
  const outcome = parseOutcome(result);

  if (outcome) {
    return (
      <article className="agent-card">
        <header className="agent-card__eyebrow">Purchase order</header>
        {outcome.outcome === "issued" && (
          <p className="agent-card__done">
            <Link className="record-link" to={`/purchase-orders/${String(outcome.purchaseOrderId)}`}>
              {String(outcome.poNumber)}
            </Link>{" "}
            issued to {String(outcome.supplierName)} for {formatCents(Number(outcome.totalCents))}.{" "}
            {outcome.emailed ? "Emailed to the supplier." : `Email failed: ${String(outcome.emailError)}`}
          </p>
        )}
        {outcome.outcome === "cancelled" && <p className="agent-card__done">Cancelled. No purchase order was created.</p>}
        {outcome.outcome === "error" && <p role="alert">{String(outcome.error)}</p>}
      </article>
    );
  }

  const row = comparison.data?.rows.find((candidate) => candidate.quoteId === args.quoteId);
  if (!respond || !comparison.data) {
    return (
      <article className="agent-card">
        <header className="agent-card__eyebrow">Purchase order</header>
        {comparison.error ? <p role="alert">{comparison.error}</p> : <p className="state-line">Preparing the order…</p>}
      </article>
    );
  }

  const recommended = comparison.data.recommendedQuoteId === args.quoteId;
  return (
    <article className="agent-card agent-card--gate">
      <header className="agent-card__eyebrow">Approve purchase order</header>
      {row ? (
        <>
          <p>
            Order from <strong>{row.supplierName}</strong> for <strong>{formatCents(row.totalCents)}</strong>, estimated
            delivery {formatDay(row.estimatedDelivery)} (needed by {formatDay(comparison.data.neededBy)}).
          </p>
          {!recommended && <p className="agent-card__warn">This is not the recommended quote.</p>}
          {!row.complete && <p role="alert">This quote does not price every line.</p>}
        </>
      ) : (
        <p role="alert">That quote is not on this requisition.</p>
      )}
      <div className="agent-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !row || !row.complete}
          onClick={() =>
            run(respond, async () => {
              const award = await awardQuote(args.requisitionId!, args.quoteId!);
              refresh();
              return {
                outcome: "issued",
                purchaseOrderId: award.purchaseOrder.id,
                poNumber: award.purchaseOrder.poNumber,
                supplierName: award.purchaseOrder.supplierName,
                totalCents: award.purchaseOrder.totalCents,
                emailed: award.emailed,
                emailError: award.emailError,
              };
            })
          }
        >
          {busy ? "Issuing…" : "Issue PO and email supplier"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            run(respond, async () => ({ outcome: "cancelled", note: "The requester cancelled. No purchase order was created." }))
          }
        >
          Cancel
        </button>
      </div>
    </article>
  );
}

export function GenerativeUI() {
  useComponent({
    name: "quote_comparison",
    description:
      "Draw the ranked quote comparison for a requisition (supplier, total, lead time, on-time vs needed-by, recommendation). Call after compare_quotes.",
    parameters: z.object({ requisitionId: z.string().describe("Requisition id") }),
    render: QuoteComparisonCard,
  });

  useHumanInTheLoop({
    name: "propose_rfq",
    description:
      "Ask the requester to approve emailing RFQs for a draft requisition. Shows the lines and the exact suppliers. Emails are sent only if they click Send; the result reports each supplier's outcome, or that they cancelled.",
    parameters: z.object({ requisitionId: z.string().describe("Draft requisition id from create_requisition") }),
    render: RfqApprovalCard,
  });

  useHumanInTheLoop({
    name: "propose_award",
    description:
      "Ask the requester to approve issuing a purchase order for one quote. On approval the PO is created and emailed to the supplier; the result contains the PO number, or that they cancelled, or an error.",
    parameters: z.object({
      requisitionId: z.string().describe("Requisition id"),
      quoteId: z.string().describe("quoteId from compare_quotes"),
    }),
    render: AwardApprovalCard,
  });

  return null;
}
