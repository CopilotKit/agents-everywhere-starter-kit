import type { QuoteComparisonRow } from "./types";

export interface RankableQuote {
  quoteId: string;
  supplierId: string;
  supplierName: string;
  lines: {
    requisitionLineId: string;
    quantityQuoted: string;
    unitPriceCents: number | null;
    totalPriceCents: number | null;
    leadTimeDays: number | null;
  }[];
}

export interface RankInput {
  quotes: RankableQuote[];
  requisitionLineIds: string[];
  neededBy: string | null;
  /** YYYY-MM-DD */
  today: string;
}

export interface RankResult {
  rows: QuoteComparisonRow[];
  recommendedQuoteId: string | null;
  reason: string;
}

export function lineTotalCents(line: RankableQuote["lines"][number]): number | null {
  if (line.totalPriceCents !== null) return line.totalPriceCents;
  if (line.unitPriceCents === null) return null;
  return Math.round(line.unitPriceCents * Number(line.quantityQuoted));
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toRow(quote: RankableQuote, input: RankInput): QuoteComparisonRow {
  const byLine = new Map(quote.lines.map((line) => [line.requisitionLineId, line]));
  const covered = input.requisitionLineIds.map((id) => byLine.get(id));
  const totals = covered.map((line) => (line ? lineTotalCents(line) : null));
  const complete = covered.length > 0 && totals.every((total) => total !== null);
  const leadTimes = covered.map((line) => line?.leadTimeDays ?? null);
  const leadTimeDays = leadTimes.every((days) => days !== null)
    ? Math.max(...(leadTimes as number[]))
    : null;
  const estimatedDelivery = leadTimeDays === null ? null : addDays(input.today, leadTimeDays);
  const meetsDeadline =
    input.neededBy === null || estimatedDelivery === null ? null : estimatedDelivery <= input.neededBy;
  return {
    quoteId: quote.quoteId,
    supplierId: quote.supplierId,
    supplierName: quote.supplierName,
    totalCents: complete ? (totals as number[]).reduce((sum, total) => sum + total, 0) : null,
    leadTimeDays,
    estimatedDelivery,
    meetsDeadline,
    complete,
  };
}

const deadlineRank = (meets: boolean | null) => (meets === true ? 0 : meets === null ? 1 : 2);
const nullsLast = (value: number | null) => value ?? Number.POSITIVE_INFINITY;

function compareRows(a: QuoteComparisonRow, b: QuoteComparisonRow): number {
  return (
    Number(b.complete) - Number(a.complete) ||
    deadlineRank(a.meetsDeadline) - deadlineRank(b.meetsDeadline) ||
    nullsLast(a.totalCents) - nullsLast(b.totalCents) ||
    nullsLast(a.leadTimeDays) - nullsLast(b.leadTimeDays) ||
    a.supplierName.localeCompare(b.supplierName)
  );
}

const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Quotes that price every line come first, then those that arrive by the
 * needed-by date, then the lowest total, then the shortest lead time.
 */
export function rankQuotes(input: RankInput): RankResult {
  const rows = input.quotes.map((quote) => toRow(quote, input)).sort(compareRows);
  const best = rows[0];
  if (!best || !best.complete || best.totalCents === null) {
    return {
      rows,
      recommendedQuoteId: null,
      reason:
        rows.length === 0
          ? "No quotes have been received yet."
          : "No quote prices every requested line yet, so there is nothing to recommend.",
    };
  }
  const total = dollars(best.totalCents);
  let reason: string;
  if (best.meetsDeadline === true) {
    reason = `${best.supplierName} has the lowest total (${total}) among quotes that deliver by ${input.neededBy} (estimated ${best.estimatedDelivery}).`;
  } else if (best.meetsDeadline === false) {
    reason = `No quote delivers by ${input.neededBy}. ${best.supplierName} is the cheapest complete quote (${total}), estimated delivery ${best.estimatedDelivery}.`;
  } else {
    reason = `${best.supplierName} has the lowest total (${total}); delivery timing could not be checked against a needed-by date.`;
  }
  return { rows, recommendedQuoteId: best.quoteId, reason };
}
