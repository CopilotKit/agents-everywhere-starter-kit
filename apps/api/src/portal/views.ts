import type { Quote } from "procure-db/types";
import { formatCents, formatQuantity, html, SafeHtml } from "../lib/html";
import type { PortalContext } from "./context";
import { fieldName } from "./form";

const STYLES = `
  :root { --ink: #1f1a14; --muted: #6b5f50; --paper: #fffdf8; --ground: #f4efe6; --rule: #d9cfbf; --accent: #b5651d; --error: #a3261b; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 16px; background: var(--ground); color: var(--ink); font: 15px/1.5 -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; background: var(--paper); border: 1px solid var(--rule); padding: 28px; }
  .eyebrow { font: 12px/1 ui-monospace, "SF Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  h1 { font-size: 24px; margin: 8px 0 4px; }
  .meta { color: var(--muted); margin: 0 0 24px; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  input, textarea { font: inherit; padding: 6px 8px; border: 1px solid var(--rule); background: #fff; width: 100%; min-width: 80px; }
  input[aria-invalid="true"] { border-color: var(--error); }
  .field-error { color: var(--error); font-size: 13px; display: block; margin-top: 2px; }
  label { font-weight: 600; display: block; margin: 16px 0 4px; }
  .hint { color: var(--muted); font-size: 13px; font-weight: 400; }
  button { font: inherit; padding: 10px 18px; border: 0; background: var(--accent); color: #fff; cursor: pointer; }
  button.secondary { background: transparent; color: var(--ink); border: 1px solid var(--rule); }
  .banner { padding: 12px 14px; border-left: 4px solid var(--error); background: #fbeeec; margin-bottom: 16px; }
  details { margin-top: 32px; border-top: 1px solid var(--rule); padding-top: 16px; }
  .num { text-align: right; white-space: nowrap; }
`;

function page(title: string, body: SafeHtml): string {
  return html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><title>${title} · Procurebot supplier portal</title>
<style>${new SafeHtml(STYLES)}</style></head>
<body><main>${body}</main></body></html>`.value;
}

function header(context: PortalContext, title: string): SafeHtml {
  const due = context.requisition.neededBy ? html` · needed by <strong>${context.requisition.neededBy}</strong>` : "";
  return html`<div class="eyebrow">Request for quotation</div>
<h1>${title}</h1>
<p class="meta">For ${context.supplier.name}${due} · link valid until ${context.invitation.expiresAt.slice(0, 10)}</p>`;
}

export function quoteFormPage(
  context: PortalContext,
  token: string,
  state: { values?: Record<string, string>; errors?: Record<string, string>; banner?: string } = {},
): string {
  const values = state.values ?? {};
  const errors = state.errors ?? {};
  const input = (name: string, fallback: string, attrs: SafeHtml) =>
    html`<input name="${name}" value="${values[name] ?? fallback}" aria-invalid="${errors[name] ? "true" : "false"}" ${attrs}>${
      errors[name] ? html`<span class="field-error">${errors[name]}</span>` : ""
    }`;
  return page(
    "Submit a quote",
    html`${header(context, "Submit your quote")}
${state.banner ? html`<div class="banner" role="alert">${state.banner}</div>` : ""}
<form method="post" action="/portal/${token}/submit" enctype="multipart/form-data">
<div class="table-wrap"><table>
<tr><th>Item</th><th>Requested</th><th>Qty you quote</th><th>Unit</th><th>Unit price (USD)</th><th>Lead time (days)</th></tr>
${context.lines.map(
  (line) => html`<tr>
<td><strong>${line.itemName}</strong><br><span class="hint">${line.sku}</span></td>
<td>${formatQuantity(line.quantityRequested)} ${line.unitOfMeasure}</td>
<td>${input(fieldName.quantity(line.id), String(Number(line.quantityRequested)), html`inputmode="decimal" required`)}</td>
<td>${input(fieldName.unit(line.id), line.unitOfMeasure ?? "each", html`required`)}</td>
<td>${input(fieldName.price(line.id), "", html`inputmode="decimal" placeholder="0.18" required`)}</td>
<td>${input(fieldName.leadTime(line.id), "", html`inputmode="numeric" placeholder="5" required`)}</td>
</tr>`,
)}
</table></div>
<label for="terms">Terms and notes <span class="hint">(optional)</span></label>
<textarea id="terms" name="terms" rows="3" placeholder="e.g. Net 30, free delivery over $500">${values.terms ?? ""}</textarea>
${errors.terms ? html`<span class="field-error">${errors.terms}</span>` : ""}
<label for="validUntil">Quote valid until <span class="hint">(optional)</span></label>
<input id="validUntil" name="validUntil" type="date" value="${values.validUntil ?? ""}">
${errors.validUntil ? html`<span class="field-error">${errors.validUntil}</span>` : ""}
<label for="document">Quote document <span class="hint">(optional PDF or image, up to 10 MB)</span></label>
<input id="document" name="document" type="file" accept="application/pdf,image/png,image/jpeg,image/webp">
<p style="margin-top: 24px;"><button type="submit">Submit quote</button></p>
</form>
<details><summary>Can't supply this?</summary>
<form method="post" action="/portal/${token}/decline">
<label for="reason">Reason for declining</label>
<textarea id="reason" name="reason" rows="2" required placeholder="e.g. Out of stock until October"></textarea>
<p><button type="submit" class="secondary">Decline this request</button></p>
</form></details>`,
  );
}

export function quoteReceivedPage(context: PortalContext, quote: Quote): string {
  const total = quote.lines.reduce((sum, line) => sum + (line.totalPriceCents ?? 0), 0);
  const names = new Map(context.lines.map((line) => [line.id, line.itemName]));
  return page(
    "Quote received",
    html`${header(context, "Thanks, your quote was received")}
<p>Submitted ${quote.submittedAt.slice(0, 16).replace("T", " ")} UTC. The buyer will be in touch if it is selected.</p>
<div class="table-wrap"><table>
<tr><th>Item</th><th class="num">Quantity</th><th class="num">Unit price</th><th class="num">Line total</th><th class="num">Lead time</th></tr>
${quote.lines.map(
  (line) => html`<tr><td>${names.get(line.requisitionLineId) ?? "Item"}</td>
<td class="num">${formatQuantity(line.quantityQuoted)} ${line.unit}</td>
<td class="num">${line.unitPriceCents === null ? "—" : formatCents(line.unitPriceCents)}</td>
<td class="num">${line.totalPriceCents === null ? "—" : formatCents(line.totalPriceCents)}</td>
<td class="num">${line.leadTimeDays ?? "—"} days</td></tr>`,
)}
<tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>${formatCents(total)}</strong></td><td></td></tr>
</table></div>`,
  );
}

export function messagePage(title: string, message: string, context?: PortalContext): string {
  return page(
    title,
    context
      ? html`${header(context, title)}<p>${message}</p>`
      : html`<div class="eyebrow">Procurebot supplier portal</div><h1>${title}</h1><p>${message}</p>`,
  );
}
