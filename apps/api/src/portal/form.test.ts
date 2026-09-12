import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldName, parseQuoteForm } from "./form";

const lines = [{ id: "l1", quantityRequested: "4000.000", unitOfMeasure: "each" }];

const body = (overrides: Record<string, string> = {}) => ({
  [fieldName.price("l1")]: "$0.185",
  [fieldName.quantity("l1")]: "4,000",
  [fieldName.unit("l1")]: "each",
  [fieldName.leadTime("l1")]: "5",
  terms: "Net 30",
  ...overrides,
});

describe("parseQuoteForm", () => {
  it("normalises money and quantities and computes the line total from the raw price", () => {
    const result = parseQuoteForm(body(), lines);
    assert.ok(result.ok);
    assert.deepEqual(result.value.lines[0], {
      requisitionLineId: "l1",
      quantityQuoted: 4000,
      unit: "each",
      unitPriceCents: 19,
      totalPriceCents: 74_000,
      leadTimeDays: 5,
    });
    assert.equal(result.value.terms, "Net 30");
    assert.equal(result.value.validUntil, null);
  });

  it("reports every invalid field and echoes what was typed", () => {
    const result = parseQuoteForm(
      body({ [fieldName.price("l1")]: "cheap", [fieldName.leadTime("l1")]: "-1", validUntil: "next week" }),
      lines,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.errors).sort(), [fieldName.leadTime("l1"), fieldName.price("l1"), "validUntil"].sort());
    assert.equal(result.values[fieldName.price("l1")], "cheap");
  });

  it("requires a positive price and quantity", () => {
    const result = parseQuoteForm(body({ [fieldName.price("l1")]: "0", [fieldName.quantity("l1")]: "" }), lines);
    assert.equal(result.ok, false);
  });

  it("defaults the unit to the catalog unit", () => {
    const result = parseQuoteForm(body({ [fieldName.unit("l1")]: "" }), lines);
    assert.ok(result.ok);
    assert.equal(result.value.lines[0]?.unit, "each");
  });
});
