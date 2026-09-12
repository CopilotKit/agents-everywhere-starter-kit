import type { SupplierCategory } from "procure-db/types";

// Domain enums and free-text categories both arrive from the backend as
// lowercase snake_case (e.g. "po_issued", "office_supplies") — normalize
// them into readable words for display, without touching the underlying
// value used for API filtering or status-tone lookups.
const ACRONYMS = new Set(["po", "rfq", "sku"]);

export function formatLabel(value: string): string {
  const rawWords = value.split("_");
  const words = rawWords.map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  const [first = "", ...rest] = words;
  const firstDisplay = ACRONYMS.has(rawWords[0] ?? "") ? first : first.charAt(0).toUpperCase() + first.slice(1);
  return [firstDisplay, ...rest].join(" ");
}

export function formatCategories(categories: SupplierCategory[]): string {
  if (categories.length === 0) return "—";
  return categories
    .map((c) => (c.preferred ? `${formatLabel(c.category)} (preferred)` : formatLabel(c.category)))
    .join(", ");
}

export function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Pinned to UTC so rendered timestamps don't shift with the viewer's
// machine timezone.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** A calendar date (YYYY-MM-DD) with no time component. */
export function formatDay(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatQty(quantity: string, unit?: string | null): string {
  const value = Number(quantity).toLocaleString("en-US");
  return unit ? `${value} ${unit}` : value;
}
