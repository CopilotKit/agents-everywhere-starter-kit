/**
 * In-memory procurement backend.
 *
 * This exists so the Slack surface — intake, RFQ, comparison, PO — can be
 * built, tested and demoed before the real service is reachable, and so the
 * offline checks in `npm run verify` never need a network or an account.
 *
 * It is a stand-in, not a simulator: quotes are synthesized deterministically
 * at RFQ time rather than actually waiting on suppliers. Anything shown from
 * here is sample data and must be labelled as such in a demo.
 */
import type { ItemRequest, ProcurementApi } from "./client";
import { ProcurementApiError } from "./client";
import type {
  CatalogItem,
  Comparison,
  PurchaseOrder,
  Quote,
  Requisition,
  RequisitionDetail,
  RequisitionLine,
  Rfq,
  Supplier,
} from "./types";

const CATALOG: CatalogItem[] = [
  { id: "itm-mon-27", name: '27" 4K Monitor', unit: "each", category: "IT hardware", indicativeUnitPrice: 340 },
  { id: "itm-mon-24", name: '24" 1080p Monitor', unit: "each", category: "IT hardware", indicativeUnitPrice: 180 },
  { id: "itm-cbl-hdmi", name: "HDMI 2.1 Cable (2m)", unit: "box of 12", category: "IT hardware", indicativeUnitPrice: 96 },
  { id: "itm-cbl-usbc", name: "USB-C Cable (1m)", unit: "box of 12", category: "IT hardware", indicativeUnitPrice: 72 },
  { id: "itm-dock-tb", name: "Thunderbolt 4 Dock", unit: "each", category: "IT hardware", indicativeUnitPrice: 260 },
  { id: "itm-kbd-mech", name: "Mechanical Keyboard", unit: "each", category: "IT hardware", indicativeUnitPrice: 110 },
  { id: "itm-chr-task", name: "Ergonomic Task Chair", unit: "each", category: "Furniture", indicativeUnitPrice: 420 },
  { id: "itm-dsk-sit", name: "Sit-Stand Desk (1600mm)", unit: "each", category: "Furniture", indicativeUnitPrice: 610 },
  { id: "itm-ppr-a4", name: "A4 Paper", unit: "ream", category: "Office supplies", indicativeUnitPrice: 6 },
  { id: "itm-wbd-mag", name: "Magnetic Whiteboard (1200mm)", unit: "each", category: "Office supplies", indicativeUnitPrice: 95 },
  { id: "itm-cof-bean", name: "Fairtrade Coffee Beans (1kg)", unit: "bag", category: "Pantry", indicativeUnitPrice: 24 },
  { id: "itm-tea-asrt", name: "Assorted Tea (200 bags)", unit: "box", category: "Pantry", indicativeUnitPrice: 18 },
];

const SUPPLIERS: Supplier[] = [
  { id: "sup-northwind", name: "Northwind Technology", categories: ["IT hardware"] },
  { id: "sup-halcyon", name: "Halcyon Office Group", categories: ["Furniture", "Office supplies"] },
  { id: "sup-brightline", name: "Brightline Supply Co", categories: ["IT hardware", "Office supplies"] },
  { id: "sup-verdant", name: "Verdant Pantry", categories: ["Pantry"] },
];

/** Deterministic 0–1 jitter, so comparisons differ per supplier but never per run. */
function jitter(...parts: string[]): number {
  const seed = parts.join(":");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000;
}

const STOP_WORDS = new Set(["a", "an", "the", "of", "for", "some", "box", "and", "with"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Token-overlap score. Crude on purpose — the point is to exercise the confirm path. */
function score(request: string, item: CatalogItem): number {
  const wanted = tokenize(request);
  if (wanted.length === 0) return 0;
  const haystack = tokenize(`${item.name} ${item.category}`);
  const hits = wanted.filter((token) =>
    haystack.some((word) => word.startsWith(token) || token.startsWith(word)),
  );
  return hits.length / wanted.length;
}

export function createFakeProcurementApi(): ProcurementApi {
  const requisitions = new Map<string, Requisition>();
  const rfqs = new Map<string, Rfq>();
  const quotes = new Map<string, Quote[]>();
  const purchaseOrders = new Map<string, PurchaseOrder>();
  let sequence = 1041;

  function requireRequisition(id: string): Requisition {
    const found = requisitions.get(id);
    if (!found) throw new ProcurementApiError(`No requisition ${id}.`, 404);
    return found;
  }

  function matchOne(request: ItemRequest, index: number): RequisitionLine {
    const quantity = request.quantity ?? 1;
    const ranked = CATALOG.map((item) => ({ item, value: score(request.text, item) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);

    const id = `line-${Date.now().toString(36)}-${index}`;
    if (ranked.length === 0) {
      return { id, itemId: null, itemName: request.text, quantity, unit: "each", status: "unmatched" };
    }

    const best = ranked[0]!;
    const runnerUp = ranked[1];
    // A clear winner settles itself. A near-tie must go back to the requester —
    // guessing here is how you order 20 of the wrong cable.
    const decisive = best.value >= 0.75 && (!runnerUp || best.value - runnerUp.value >= 0.25);
    if (decisive) {
      return {
        id,
        itemId: best.item.id,
        itemName: best.item.name,
        quantity,
        unit: best.item.unit,
        status: "confirmed",
      };
    }
    return {
      id,
      itemId: null,
      itemName: request.text,
      quantity,
      unit: best.item.unit,
      status: "needs_confirmation",
      candidates: ranked.slice(0, 3).map(({ item }) => ({
        itemId: item.id,
        name: item.name,
        unit: item.unit,
      })),
    };
  }

  function suppliersFor(requisition: Requisition): Supplier[] {
    const categories = new Set(
      requisition.lines
        .map((line) => CATALOG.find((item) => item.id === line.itemId)?.category)
        .filter((category): category is string => Boolean(category)),
    );
    const matched = SUPPLIERS.filter((supplier) =>
      supplier.categories.some((category) => categories.has(category)),
    );
    return matched.length > 0 ? matched : SUPPLIERS.slice(0, 2);
  }

  /** Synthesized at dispatch. One supplier is made to decline a line, so the
   *  "no one quoted this" path is demonstrable rather than theoretical. */
  function buildQuotes(requisition: Requisition, invited: Supplier[]): Quote[] {
    const confirmed = requisition.lines.filter((line) => line.status === "confirmed");
    return invited.map((supplier, supplierIndex) => {
      const lines = confirmed.map((line, lineIndex) => {
        const item = CATALOG.find((candidate) => candidate.id === line.itemId);
        const base = item?.indicativeUnitPrice ?? 50;
        const spread = 0.85 + jitter(supplier.id, line.id) * 0.4;
        const declines = supplierIndex === invited.length - 1 && lineIndex === confirmed.length - 1 && confirmed.length > 1;
        return {
          lineId: line.id,
          itemName: line.itemName,
          quantity: line.quantity,
          unitPrice: declines ? 0 : Math.round(base * spread * 100) / 100,
          leadTimeDays: 3 + Math.round(jitter(supplier.id, "lead", line.id) * 18),
          available: !declines,
        };
      });
      const available = lines.filter((line) => line.available);
      return {
        id: `quote-${supplier.id}-${requisition.id}`,
        requisitionId: requisition.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lines,
        total: Math.round(available.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100) / 100,
        currency: "USD",
        leadTimeDays: available.reduce((longest, line) => Math.max(longest, line.leadTimeDays), 0),
        submittedAt: new Date().toISOString(),
        notes: lines.some((line) => !line.available)
          ? "One line could not be supplied."
          : undefined,
      };
    });
  }

  return {
    async listCatalog(params) {
      const query = params?.query?.trim();
      const pool = query
        ? CATALOG.map((item) => ({ item, value: score(query, item) }))
            .filter((entry) => entry.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((entry) => entry.item)
        : CATALOG;
      return pool.slice(0, params?.limit ?? 20);
    },

    async getRequisitionByCode(code) {
      const wanted = code.trim().toUpperCase();
      return (
        [...requisitions.values()].find((requisition) => requisition.code === wanted) ?? null
      );
    },

    async createRequisition({ requesterId, title }) {
      const id = `req-${(sequence + 1).toString(36)}`;
      const requisition: Requisition = {
        id,
        code: `REQ-${++sequence}`,
        requesterId,
        title: title ?? "Untitled request",
        status: "draft",
        lines: [],
        createdAt: new Date().toISOString(),
      };
      requisitions.set(id, requisition);
      return requisition;
    },

    async addItems({ requisitionId, requests }) {
      const requisition = requireRequisition(requisitionId);
      if (requisition.status !== "draft") {
        throw new ProcurementApiError(
          `${requisition.code} has already been sent for quotes; items cannot be added.`,
          409,
        );
      }
      requisition.lines.push(...requests.map(matchOne));
      return requisition;
    },

    async resolveLine({ requisitionId, lineId, itemId, quantity }) {
      const requisition = requireRequisition(requisitionId);
      const line = requisition.lines.find((candidate) => candidate.id === lineId);
      if (!line) throw new ProcurementApiError(`No line ${lineId} on ${requisition.code}.`, 404);

      if (itemId === null) {
        requisition.lines = requisition.lines.filter((candidate) => candidate.id !== lineId);
        return requisition;
      }
      if (itemId !== undefined) {
        const item = CATALOG.find((candidate) => candidate.id === itemId);
        if (!item) throw new ProcurementApiError(`${itemId} is not a catalog item.`, 400);
        line.itemId = item.id;
        line.itemName = item.name;
        line.unit = item.unit;
        line.status = "confirmed";
        delete line.candidates;
      }
      if (quantity !== undefined) {
        if (quantity <= 0) throw new ProcurementApiError("Quantity must be greater than zero.", 400);
        line.quantity = quantity;
      }
      return requisition;
    },

    async getRequisition(requisitionId) {
      const requisition = requisitions.get(requisitionId);
      if (!requisition) return null;
      return {
        requisition,
        rfq: rfqs.get(requisitionId) ?? null,
        quotes: quotes.get(requisitionId) ?? [],
        purchaseOrder: purchaseOrders.get(requisitionId) ?? null,
      } satisfies RequisitionDetail;
    },

    async findRequisitions(params) {
      return [...requisitions.values()]
        .filter((requisition) =>
          (!params?.requesterId || requisition.requesterId === params.requesterId) &&
          (!params?.status || requisition.status === params.status),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listSuppliers(params) {
      return params?.category
        ? SUPPLIERS.filter((supplier) => supplier.categories.includes(params.category!))
        : SUPPLIERS;
    },

    async sendForQuotes({ requisitionId, supplierIds }) {
      const requisition = requireRequisition(requisitionId);
      const unsettled = requisition.lines.filter((line) => line.status !== "confirmed");
      if (unsettled.length > 0) {
        throw new ProcurementApiError(
          `${unsettled.length} line(s) on ${requisition.code} are not settled yet: ${unsettled
            .map((line) => line.itemName)
            .join(", ")}. Confirm them before sending.`,
          409,
        );
      }
      if (requisition.lines.length === 0) {
        throw new ProcurementApiError(`${requisition.code} has no items yet.`, 409);
      }

      const invited = supplierIds
        ? SUPPLIERS.filter((supplier) => supplierIds.includes(supplier.id))
        : suppliersFor(requisition);
      if (invited.length === 0) {
        throw new ProcurementApiError("No suppliers match these items.", 409);
      }

      // Deterministic partial failure: the last invitee bounces on the first
      // dispatch so the resend path is real, not hypothetical.
      const alreadyTried = rfqs.has(requisitionId);
      const rfq: Rfq = {
        id: `rfq-${requisitionId}`,
        requisitionId,
        sentAt: new Date().toISOString(),
        invitations: invited.map((supplier, index) => {
          const fails = !alreadyTried && invited.length > 2 && index === invited.length - 1;
          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: fails ? ("failed" as const) : ("sent" as const),
            ...(fails ? { error: "Invitation bounced: no deliverable contact on file." } : {}),
          };
        }),
      };
      rfqs.set(requisitionId, rfq);
      requisition.status = "rfq_sent";

      const responders = invited.filter((supplier) =>
        rfq.invitations.some(
          (invitation) => invitation.supplierId === supplier.id && invitation.status !== "failed",
        ),
      );
      quotes.set(requisitionId, buildQuotes(requisition, responders));
      if (responders.length > 0) requisition.status = "quotes_in";
      return rfq;
    },

    async resendFailedInvitations({ requisitionId }) {
      const requisition = requireRequisition(requisitionId);
      const rfq = rfqs.get(requisitionId);
      if (!rfq) throw new ProcurementApiError(`${requisition.code} has not been sent for quotes.`, 409);
      const failed = rfq.invitations.filter((invitation) => invitation.status === "failed");
      if (failed.length === 0) return rfq;

      for (const invitation of failed) {
        invitation.status = "sent";
        delete invitation.error;
      }
      const recovered = SUPPLIERS.filter((supplier) =>
        failed.some((invitation) => invitation.supplierId === supplier.id),
      );
      quotes.set(requisitionId, [
        ...(quotes.get(requisitionId) ?? []),
        ...buildQuotes(requisition, recovered),
      ]);
      requisition.status = "quotes_in";
      return rfq;
    },

    async compareQuotes({ requisitionId }) {
      const requisition = requireRequisition(requisitionId);
      const received = quotes.get(requisitionId) ?? [];
      const confirmed = requisition.lines.filter((line) => line.status === "confirmed");

      const unquotedItemNames = confirmed
        .filter((line) =>
          received.length > 0 &&
          !received.some((quote) =>
            quote.lines.some((quoteLine) => quoteLine.lineId === line.id && quoteLine.available),
          ),
        )
        .map((line) => line.itemName);

      // Only a quote covering every line is recommendable; a cheap partial
      // quote is not actually cheaper, it is incomplete.
      const complete = received.filter((quote) =>
        confirmed.every((line) =>
          quote.lines.some((quoteLine) => quoteLine.lineId === line.id && quoteLine.available),
        ),
      );
      const winner = [...complete].sort(
        (a, b) => a.total - b.total || a.leadTimeDays - b.leadTimeDays,
      )[0];

      let rationale: string;
      if (received.length === 0) {
        rationale = "No quotes have come back yet.";
      } else if (!winner) {
        rationale = "No supplier quoted every line, so there is no complete quote to recommend.";
      } else {
        const others = complete.filter((quote) => quote.id !== winner.id);
        const margin = others.length > 0 ? Math.min(...others.map((quote) => quote.total)) - winner.total : 0;
        rationale =
          margin > 0
            ? `${winner.supplierName} is lowest at ${winner.currency} ${winner.total.toFixed(2)}, ${winner.currency} ${margin.toFixed(2)} under the next complete quote, delivering in ${winner.leadTimeDays} days.`
            : `${winner.supplierName} is the only complete quote, at ${winner.currency} ${winner.total.toFixed(2)} over ${winner.leadTimeDays} days.`;
      }

      return {
        requisitionId,
        quotes: received,
        recommendedQuoteId: winner?.id ?? null,
        rationale,
        unquotedItemNames,
      } satisfies Comparison;
    },

    async issuePurchaseOrder({ requisitionId, quoteId, approvedBy }) {
      const requisition = requireRequisition(requisitionId);
      const existing = purchaseOrders.get(requisitionId);
      // Issuing twice is the one mistake with real money attached.
      if (existing) {
        throw new ProcurementApiError(
          `${requisition.code} already has purchase order ${existing.number}.`,
          409,
        );
      }
      const quote = (quotes.get(requisitionId) ?? []).find((candidate) => candidate.id === quoteId);
      if (!quote) throw new ProcurementApiError(`No quote ${quoteId} on ${requisition.code}.`, 404);

      const order: PurchaseOrder = {
        id: `po-${requisitionId}`,
        number: `PO-${2000 + sequence}`,
        requisitionId,
        quoteId,
        supplierName: quote.supplierName,
        total: quote.total,
        currency: quote.currency,
        issuedAt: new Date().toISOString(),
      };
      purchaseOrders.set(requisitionId, order);
      requisition.status = "ordered";
      void approvedBy;
      return order;
    },
  };
}
