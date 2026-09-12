export interface QuoteFormLine {
  id: string;
  quantityRequested: string;
  unitOfMeasure: string | null;
}

export interface ParsedQuoteLine {
  requisitionLineId: string;
  quantityQuoted: number;
  unit: string;
  unitPriceCents: number;
  totalPriceCents: number;
  leadTimeDays: number;
}

export interface ParsedQuote {
  lines: ParsedQuoteLine[];
  terms: string | null;
  validUntil: string | null;
}

export type QuoteFormResult =
  | { ok: true; value: ParsedQuote }
  | { ok: false; errors: Record<string, string>; values: Record<string, string> };

export const fieldName = {
  price: (lineId: string) => `price-${lineId}`,
  quantity: (lineId: string) => `qty-${lineId}`,
  unit: (lineId: string) => `unit-${lineId}`,
  leadTime: (lineId: string) => `lead-${lineId}`,
};

const MONEY = /^\d{1,9}(\.\d{1,4})?$/;
const QUANTITY = /^\d{1,9}(\.\d{1,3})?$/;
const INTEGER = /^\d{1,3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Validates the supplier's quote form for every requisition line. */
export function parseQuoteForm(body: Record<string, unknown>, lines: QuoteFormLine[]): QuoteFormResult {
  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};
  const parsed: ParsedQuoteLine[] = [];

  for (const line of lines) {
    const priceField = fieldName.price(line.id);
    const quantityField = fieldName.quantity(line.id);
    const unitField = fieldName.unit(line.id);
    const leadField = fieldName.leadTime(line.id);
    const rawPrice = text(body[priceField]).replace(/^\$/, "").replace(/,/g, "");
    const rawQuantity = text(body[quantityField]).replace(/,/g, "");
    const unit = text(body[unitField]) || line.unitOfMeasure || "each";
    const rawLead = text(body[leadField]);
    values[priceField] = text(body[priceField]);
    values[quantityField] = text(body[quantityField]);
    values[unitField] = unit;
    values[leadField] = rawLead;

    const price = MONEY.test(rawPrice) ? Number(rawPrice) : NaN;
    if (!(price > 0)) errors[priceField] = "Enter a unit price greater than zero, e.g. 0.18";
    const quantity = QUANTITY.test(rawQuantity) ? Number(rawQuantity) : NaN;
    if (!(quantity > 0)) errors[quantityField] = "Enter the quantity you are quoting";
    if (unit.length > 32) errors[unitField] = "Keep the unit under 32 characters";
    const leadTime = INTEGER.test(rawLead) ? Number(rawLead) : NaN;
    if (!(leadTime >= 0 && leadTime <= 365)) errors[leadField] = "Enter lead time in whole days (0–365)";

    if (!errors[priceField] && !errors[quantityField] && !errors[leadField] && !errors[unitField]) {
      parsed.push({
        requisitionLineId: line.id,
        quantityQuoted: quantity,
        unit,
        unitPriceCents: Math.round(price * 100),
        totalPriceCents: Math.round(price * quantity * 100),
        leadTimeDays: leadTime,
      });
    }
  }

  const terms = text(body.terms);
  const validUntil = text(body.validUntil);
  values.terms = terms;
  values.validUntil = validUntil;
  if (terms.length > 500) errors.terms = "Keep terms under 500 characters";
  if (validUntil && !ISO_DATE.test(validUntil)) errors.validUntil = "Use a date like 2026-10-01";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return { ok: true, value: { lines: parsed, terms: terms || null, validUntil: validUntil || null } };
}
