import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, rankQuotes, type RankableQuote } from "./rank";

const line = (overrides: Partial<RankableQuote["lines"][number]> = {}) => ({
  requisitionLineId: "line-1",
  quantityQuoted: "4000",
  unitPriceCents: 25,
  totalPriceCents: null,
  leadTimeDays: 3,
  ...overrides,
});

const quote = (name: string, lines: RankableQuote["lines"]): RankableQuote => ({
  quoteId: `q-${name}`,
  supplierId: `s-${name}`,
  supplierName: name,
  lines,
});

const base = { requisitionLineIds: ["line-1"], neededBy: "2026-09-18", today: "2026-09-12" };

describe("rankQuotes", () => {
  it("prefers a quote that meets the deadline over a cheaper late one", () => {
    const result = rankQuotes({
      ...base,
      quotes: [
        quote("Cheap but late", [line({ unitPriceCents: 10, leadTimeDays: 14 })]),
        quote("On time", [line({ unitPriceCents: 20, leadTimeDays: 4 })]),
      ],
    });
    assert.equal(result.recommendedQuoteId, "q-On time");
    assert.equal(result.rows[0]?.totalCents, 80_000);
    assert.equal(result.rows[0]?.estimatedDelivery, "2026-09-16");
    assert.equal(result.rows[1]?.meetsDeadline, false);
    assert.match(result.reason, /On time has the lowest total \(\$800\.00\)/);
  });

  it("breaks price ties by lead time and uses an explicit line total when given", () => {
    const result = rankQuotes({
      ...base,
      quotes: [
        quote("Slow", [line({ totalPriceCents: 90_000, leadTimeDays: 5 })]),
        quote("Fast", [line({ totalPriceCents: 90_000, leadTimeDays: 2 })]),
      ],
    });
    assert.deepEqual(
      result.rows.map((row) => row.supplierName),
      ["Fast", "Slow"],
    );
  });

  it("ranks incomplete quotes last and never recommends them", () => {
    const result = rankQuotes({
      ...base,
      requisitionLineIds: ["line-1", "line-2"],
      quotes: [quote("Partial", [line()])],
    });
    assert.equal(result.recommendedQuoteId, null);
    assert.equal(result.rows[0]?.complete, false);
    assert.match(result.reason, /No quote prices every requested line/);
  });

  it("explains when nothing arrives in time", () => {
    const result = rankQuotes({
      ...base,
      quotes: [quote("Late", [line({ leadTimeDays: 30 })])],
    });
    assert.equal(result.recommendedQuoteId, "q-Late");
    assert.match(result.reason, /No quote delivers by 2026-09-18/);
  });

  it("handles an empty quote list", () => {
    const result = rankQuotes({ ...base, quotes: [] });
    assert.equal(result.recommendedQuoteId, null);
    assert.equal(result.reason, "No quotes have been received yet.");
  });
});

describe("addDays", () => {
  it("crosses month boundaries in UTC", () => {
    assert.equal(addDays("2026-09-28", 5), "2026-10-03");
  });
});
