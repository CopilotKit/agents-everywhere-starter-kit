const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);

type Interpolation = SafeHtml | string | number | null | undefined | false | Interpolation[];

function render(value: Interpolation): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(render).join("");
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(String(value));
}

/** Tagged template that escapes every interpolation unless it is already SafeHtml. */
export function html(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, index) => {
    out += render(value) + (strings[index + 1] ?? "");
  });
  return new SafeHtml(out);
}

export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const formatQuantity = (quantity: string) => Number(quantity).toLocaleString("en-US");
