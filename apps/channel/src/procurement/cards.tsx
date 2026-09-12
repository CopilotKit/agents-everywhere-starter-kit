/**
 * Native Slack cards for the purchasing flow.
 *
 * Plain render functions called by the tools, not `defineChannelComponent`
 * components the agent calls. Every figure here — unit prices, totals, lead
 * times, PO numbers — comes from the backend response the tool already holds,
 * so the model never gets a chance to retype a price on its way to the screen.
 * Same reasoning as erp-frontend's approval cards re-fetching their own data.
 *
 * Money from procure-db is integer cents. It is formatted here, once.
 */
import {
  Actions,
  Button,
  Context,
  Divider,
  Field,
  Fields,
  Header,
  Markdown,
  Message,
  Row,
  Cell,
  Section,
  Table,
} from "@copilotkit/channels";
import type { Invitee } from "procure-db";
import type {
  PurchaseOrder,
  QuoteComparison,
  RequisitionDetail,
  RequisitionStatus,
  RfqDispatchResult,
} from "procure-db/types";
import type { InteractionContext } from "@copilotkit/channels";

const ACCENT_REQUEST = "#4A6FA5";
const ACCENT_QUOTES = "#1F8A70";
const ACCENT_GATE = "#C4145F";
const ACCENT_ORDERED = "#5B3FA8";

/** Integer cents → "$1,295.00". */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function day(value: string | null): string {
  return value ?? "no date set";
}

/** NUMERIC comes back as a string; show it without trailing zeros. */
function qty(value: string, unit: string | null): string {
  const n = Number(value);
  const shown = Number.isFinite(n) ? String(n) : value;
  return unit ? `${shown} ${unit}` : shown;
}

const STATUS_WORDS: Record<RequisitionStatus, string> = {
  intake: "still being put together",
  rfq_dispatched: "out with suppliers, waiting on quotes",
  comparing: "quotes in, ready to compare",
  pending_approval: "waiting on approval",
  approved: "approved, purchase order pending",
  rejected: "rejected",
  po_issued: "ordered",
  closed: "closed",
};

/** The request: what is on it, and what it is waiting on. */
export function requisitionCard(detail: RequisitionDetail) {
  const ordered = detail.purchaseOrders.length > 0;
  return (
    <Message accent={ordered ? ACCENT_ORDERED : ACCENT_REQUEST}>
      <Header>{`Request — ${STATUS_WORDS[detail.status] ?? detail.status}`}</Header>
      {/* waitingOn is computed by procure-db; prefer it over re-deriving. */}
      <Context>{detail.waitingOn}</Context>

      {detail.lines.length === 0 ? (
        <Section>Nothing on this request yet.</Section>
      ) : (
        <Table columns={[{ header: "Item" }, { header: "Qty", align: "right" }, { header: "SKU" }]}>
          {detail.lines.map((line) => (
            <Row>
              <Cell>{line.itemName ?? line.rawDescription}</Cell>
              <Cell>{qty(line.quantityRequested, line.unitOfMeasure)}</Cell>
              <Cell>{line.sku ?? "—"}</Cell>
            </Row>
          ))}
        </Table>
      )}

      <Fields>
        <Field label="Needed by">{day(detail.neededBy)}</Field>
        <Field label="Quotes in">{String(detail.quotes.length)}</Field>
        <Field label="Invited">{String(detail.rfq?.invitations.length ?? 0)}</Field>
      </Fields>

      {detail.purchaseOrders.length > 0 && (
        <>
          <Divider />
          {detail.purchaseOrders.map((po) => (
            <Section>
              <Markdown>{`**${po.poNumber}** — ${po.supplierName}, ${money(po.totalCents)}`}</Markdown>
            </Section>
          ))}
        </>
      )}
    </Message>
  );
}

/** Who was emailed, and who bounced. */
export function rfqResultCard(result: RfqDispatchResult) {
  const failed = result.invitations.filter((invitation) => invitation.status === "send_failed");
  return (
    <Message accent={failed.length > 0 ? ACCENT_GATE : ACCENT_QUOTES}>
      <Header>RFQs sent</Header>
      <Table columns={[{ header: "Supplier" }, { header: "Invitation" }]}>
        {result.invitations.map((invitation) => (
          <Row>
            <Cell>{invitation.supplierName}</Cell>
            <Cell>{invitation.status === "send_failed" ? "failed to send" : invitation.status}</Cell>
          </Row>
        ))}
      </Table>
      {failed.map((invitation) => (
        <Context>{`${invitation.supplierName}: ${invitation.error ?? "the email could not be sent"}`}</Context>
      ))}
      {failed.length > 0 && (
        <Context>
          There is no retry for a failed invitation yet — someone will need to contact that supplier directly.
        </Context>
      )}
    </Message>
  );
}

/**
 * The ranked comparison. Ordering is procure-db's `rankQuotes`: complete
 * quotes first, then on-time against needed-by, then total, then lead time.
 */
export function comparisonCard(comparison: QuoteComparison) {
  return (
    <Message accent={ACCENT_QUOTES}>
      <Header>Quotes</Header>
      <Context>{`Needed by ${day(comparison.neededBy)}`}</Context>

      {comparison.rows.length === 0 ? (
        <Section>No quotes have come back yet.</Section>
      ) : (
        <Table
          columns={[
            { header: "Supplier" },
            { header: "Total", align: "right" },
            { header: "Delivery" },
            { header: "Covers all" },
          ]}
        >
          {comparison.rows.map((row) => (
            <Row>
              <Cell>
                {row.quoteId === comparison.recommendedQuoteId
                  ? `${row.supplierName} ← recommended`
                  : row.supplierName}
              </Cell>
              <Cell>{money(row.totalCents)}</Cell>
              <Cell>
                {`${day(row.estimatedDelivery)}${row.meetsDeadline === false ? " (late)" : ""}`}
              </Cell>
              <Cell>{row.complete ? "yes" : "no"}</Cell>
            </Row>
          ))}
        </Table>
      )}

      {comparison.rows.length > 0 && (
        <Section>
          <Markdown>{comparison.reason}</Markdown>
        </Section>
      )}
    </Message>
  );
}

/**
 * The RFQ gate. Clicking emails every listed supplier a quote link.
 *
 * This mirrors erp-frontend's `propose_rfq`: the agent may prepare the send,
 * but only a person causes the emails to leave.
 */
export function rfqApprovalCard(
  detail: RequisitionDetail,
  invitees: Invitee[],
  onDecide: (approved: boolean, ctx: InteractionContext<boolean>) => Promise<void>,
) {
  const alreadySent = detail.status !== "intake";
  return (
    <Message accent={ACCENT_GATE}>
      <Header>Approve sending this out for quotes?</Header>
      <Table columns={[{ header: "Item" }, { header: "Qty", align: "right" }]}>
        {detail.lines.map((line) => (
          <Row>
            <Cell>{line.itemName ?? line.rawDescription}</Cell>
            <Cell>{qty(line.quantityRequested, line.unitOfMeasure)}</Cell>
          </Row>
        ))}
      </Table>
      <Section>
        <Markdown>{`Needed by **${day(detail.neededBy)}**. A quote link will be emailed to:`}</Markdown>
      </Section>
      {invitees.map((supplier) => (
        <Context>
          {`${supplier.name}${supplier.preferred ? " (preferred)" : ""} — ${supplier.email ?? "no email on file"}`}
        </Context>
      ))}
      {alreadySent && <Context>This request has already been sent out once.</Context>}
      <Context>Approving sends real email to these suppliers.</Context>
      <Actions>
        <Button
          value={true}
          style="primary"
          onClick={async (ctx) => {
            await onDecide(true, ctx);
          }}
        >
          {`Send to ${invitees.length} supplier${invitees.length === 1 ? "" : "s"}`}
        </Button>
        <Button
          value={false}
          style="danger"
          onClick={async (ctx) => {
            await onDecide(false, ctx);
          }}
        >
          Cancel
        </Button>
      </Actions>
    </Message>
  );
}

/** The award gate. Clicking creates the purchase order and emails the supplier. */
export function awardApprovalCard(
  comparison: QuoteComparison,
  quoteId: string,
  onDecide: (approved: boolean, ctx: InteractionContext<boolean>) => Promise<void>,
) {
  const row = comparison.rows.find((candidate) => candidate.quoteId === quoteId);
  const recommended = comparison.recommendedQuoteId === quoteId;
  return (
    <Message accent={ACCENT_GATE}>
      <Header>Approve this purchase order?</Header>
      {row ? (
        <>
          <Section>
            <Markdown>
              {`**${row.supplierName}** — ${money(row.totalCents)}, delivery ${day(row.estimatedDelivery)} (needed by ${day(comparison.neededBy)}).`}
            </Markdown>
          </Section>
          {!recommended && <Context>This is not the recommended quote.</Context>}
          {!row.complete && <Context>This quote does not price every line on the request.</Context>}
        </>
      ) : (
        <Section>That quote is not on this request.</Section>
      )}
      <Context>Approving issues a purchase order and emails it to the supplier.</Context>
      <Actions>
        <Button
          value={true}
          style="primary"
          onClick={async (ctx) => {
            await onDecide(true, ctx);
          }}
        >
          Issue PO and email supplier
        </Button>
        <Button
          value={false}
          style="danger"
          onClick={async (ctx) => {
            await onDecide(false, ctx);
          }}
        >
          Cancel
        </Button>
      </Actions>
    </Message>
  );
}

/** The result: a real record. */
export function purchaseOrderCard(po: PurchaseOrder, emailed: boolean, emailError: string | null) {
  return (
    <Message accent={ACCENT_ORDERED}>
      <Header>{`${po.poNumber} issued`}</Header>
      <Section>
        <Markdown>{`**${po.supplierName}** — ${money(po.totalCents)}`}</Markdown>
      </Section>
      <Table columns={[{ header: "Item" }, { header: "Qty", align: "right" }, { header: "Total", align: "right" }]}>
        {po.lines.map((line) => (
          <Row>
            <Cell>{line.itemName}</Cell>
            <Cell>{qty(line.orderedQty, null)}</Cell>
            <Cell>{money(line.totalPriceCents)}</Cell>
          </Row>
        ))}
      </Table>
      <Context>
        {emailed ? "Emailed to the supplier." : `The PO was created but the email failed: ${emailError ?? "unknown error"}.`}
      </Context>
    </Message>
  );
}
