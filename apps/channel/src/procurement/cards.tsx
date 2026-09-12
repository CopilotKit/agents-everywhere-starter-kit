/**
 * Native cards for the purchasing flow.
 *
 * These are plain render functions called by the tools, NOT
 * `defineChannelComponent` components the agent calls. That is deliberate:
 * every number here — unit prices, totals, lead times, PO references — comes
 * straight from the backend response the tool already holds. Routing it back
 * through the model as component arguments would give it an opportunity to
 * retype a price, and a purchasing agent that fabricates a total is worse than
 * one that renders nothing.
 *
 * The agent still decides *when* a card appears, by choosing to call the tool.
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
import type {
  Comparison,
  PurchaseOrder,
  Quote,
  Requisition,
  RequisitionDetail,
  Rfq,
} from "agent-core";

const ACCENT_REQUEST = "#4A6FA5";
const ACCENT_QUOTES = "#1F8A70";
const ACCENT_APPROVAL = "#C4145F";
const ACCENT_ORDERED = "#5B3FA8";

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

const STATUS_WORDS: Record<Requisition["status"], string> = {
  draft: "still being put together",
  rfq_sent: "out with suppliers, waiting on quotes",
  quotes_in: "quotes received, ready to compare",
  approved: "approved, purchase order pending",
  ordered: "ordered",
  cancelled: "cancelled",
};

/** The request itself: what is on it, and what it is waiting on. */
export function requisitionCard(detail: RequisitionDetail) {
  const { requisition, rfq, quotes, purchaseOrder } = detail;
  const unsettled = requisition.lines.filter((line) => line.status !== "confirmed");

  return (
    <Message accent={purchaseOrder ? ACCENT_ORDERED : ACCENT_REQUEST}>
      <Header>{`${requisition.code} — ${requisition.title}`}</Header>
      <Context>{STATUS_WORDS[requisition.status]}</Context>

      {requisition.lines.length === 0 ? (
        <Section>Nothing on this request yet.</Section>
      ) : (
        <Table
          columns={[
            { header: "Item" },
            { header: "Qty", align: "right" },
            { header: "Unit" },
          ]}
        >
          {requisition.lines.map((line) => (
            <Row>
              <Cell>
                {line.status === "confirmed" ? line.itemName : `${line.itemName} (unconfirmed)`}
              </Cell>
              <Cell>{String(line.quantity)}</Cell>
              <Cell>{line.unit}</Cell>
            </Row>
          ))}
        </Table>
      )}

      {unsettled.length > 0 && (
        <Context>
          {`${unsettled.length} line${unsettled.length === 1 ? "" : "s"} still need confirming before this can go out for quotes.`}
        </Context>
      )}

      {rfq && (
        <>
          <Divider />
          <Fields>
            <Field label="Invited">{String(rfq.invitations.length)}</Field>
            <Field label="Quoted">{String(quotes.length)}</Field>
            <Field label="Failed">
              {String(rfq.invitations.filter((invitation) => invitation.status === "failed").length)}
            </Field>
          </Fields>
        </>
      )}

      {purchaseOrder && (
        <Section>
          <Markdown>
            {`Ordered from **${purchaseOrder.supplierName}** — ${purchaseOrder.number}, ${money(purchaseOrder.total, purchaseOrder.currency)}`}
          </Markdown>
        </Section>
      )}
    </Message>
  );
}

/** Who was invited, and who bounced. Separated so a resend can be offered. */
export function rfqCard(rfq: Rfq, requisition: Requisition) {
  const failed = rfq.invitations.filter((invitation) => invitation.status === "failed");

  return (
    <Message accent={failed.length > 0 ? ACCENT_APPROVAL : ACCENT_QUOTES}>
      <Header>{`${requisition.code} sent for quotes`}</Header>
      <Table columns={[{ header: "Supplier" }, { header: "Invitation" }]}>
        {rfq.invitations.map((invitation) => (
          <Row>
            <Cell>{invitation.supplierName}</Cell>
            <Cell>{invitation.status === "failed" ? "failed to deliver" : invitation.status}</Cell>
          </Row>
        ))}
      </Table>
      {failed.map((invitation) => (
        <Context>{`${invitation.supplierName}: ${invitation.error ?? "invitation failed"}`}</Context>
      ))}
    </Message>
  );
}

/** The comparison. The recommendation is the backend's, not the model's. */
export function comparisonCard(comparison: Comparison, requisition: Requisition) {
  const { quotes, recommendedQuoteId, rationale, unquotedItemNames } = comparison;

  return (
    <Message accent={ACCENT_QUOTES}>
      <Header>{`Quotes for ${requisition.code}`}</Header>

      {quotes.length === 0 ? (
        <Section>No quotes have come back yet.</Section>
      ) : (
        <Table
          columns={[
            { header: "Supplier" },
            { header: "Total", align: "right" },
            { header: "Lead time", align: "right" },
            { header: "Covers" },
          ]}
        >
          {quotes.map((quote) => {
            const missing = quote.lines.filter((line) => !line.available).length;
            return (
              <Row>
                <Cell>
                  {quote.id === recommendedQuoteId
                    ? `${quote.supplierName} ← recommended`
                    : quote.supplierName}
                </Cell>
                <Cell>{money(quote.total, quote.currency)}</Cell>
                <Cell>{`${quote.leadTimeDays}d`}</Cell>
                <Cell>{missing === 0 ? "all lines" : `${missing} line(s) missing`}</Cell>
              </Row>
            );
          })}
        </Table>
      )}

      {quotes.length > 0 && (
        <Section>
          <Markdown>{rationale}</Markdown>
        </Section>
      )}

      {unquotedItemNames.length > 0 && (
        <Context>
          {`No supplier quoted: ${unquotedItemNames.join(", ")}. Ordering any of these quotes leaves those items unfulfilled.`}
        </Context>
      )}
    </Message>
  );
}

/**
 * The approval gate. The click is what issues the PO — see `tools.tsx`.
 * `onIssue` is passed in so this file stays free of backend calls.
 */
export function approvalCard(
  quote: Quote,
  requisition: Requisition,
  comparison: Comparison,
  onIssue: (approved: boolean, ctx: import("@copilotkit/channels").InteractionContext<boolean>) => Promise<void>,
) {
  const missing = quote.lines.filter((line) => !line.available);

  return (
    <Message accent={ACCENT_APPROVAL}>
      <Header>{`Approve purchase order for ${requisition.code}?`}</Header>
      <Section>
        <Markdown>
          {`**${quote.supplierName}** — ${money(quote.total, quote.currency)}, delivering in ${quote.leadTimeDays} days.`}
        </Markdown>
      </Section>
      <Fields>
        <Field label="Request">{requisition.code}</Field>
        <Field label="Lines">{String(quote.lines.length)}</Field>
        <Field label="Currency">{quote.currency}</Field>
      </Fields>

      {quote.id !== comparison.recommendedQuoteId && comparison.recommendedQuoteId !== null && (
        <Context>
          This is not the recommended quote. Recommended:{" "}
          {comparison.quotes.find((candidate) => candidate.id === comparison.recommendedQuoteId)
            ?.supplierName ?? "unknown"}
          .
        </Context>
      )}

      {missing.length > 0 && (
        <Context>
          {`This quote does not cover: ${missing.map((line) => line.itemName).join(", ")}.`}
        </Context>
      )}

      <Context>Approving issues a purchase order. This spends money and is not reversible here.</Context>

      <Actions>
        <Button
          value={true}
          style="primary"
          onClick={async (ctx) => {
            await onIssue(true, ctx);
          }}
        >
          Approve and issue PO
        </Button>
        <Button
          value={false}
          style="danger"
          onClick={async (ctx) => {
            await onIssue(false, ctx);
          }}
        >
          Hold
        </Button>
      </Actions>
    </Message>
  );
}

/** The result: a real record, which is the whole point of the flow. */
export function purchaseOrderCard(order: PurchaseOrder) {
  return (
    <Message accent={ACCENT_ORDERED}>
      <Header>{`${order.number} issued`}</Header>
      <Section>
        <Markdown>
          {`**${order.supplierName}** — ${money(order.total, order.currency)}`}
        </Markdown>
      </Section>
      <Context>{`Issued ${new Date(order.issuedAt).toUTCString()}`}</Context>
      {order.url && (
        <Actions>
          <Button url={order.url}>Open purchase order</Button>
        </Actions>
      )}
    </Message>
  );
}
