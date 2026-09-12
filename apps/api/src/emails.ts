import type { PurchaseOrder, RequisitionLine } from "procure-db/types";
import { formatCents, formatQuantity, html } from "./lib/html";
import type { MailMessage } from "./lib/mailer";

const shell = (title: string, body: ReturnType<typeof html>) => html`<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, sans-serif; color: #1f1a14; background: #f4efe6; padding: 24px;">
<div style="max-width: 640px; margin: 0 auto; background: #fffdf8; border: 1px solid #d9cfbf; padding: 24px;">
<h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
${body}
<p style="color: #6b5f50; font-size: 12px; margin-top: 24px;">Sent by Procurebot on behalf of the procurement team.</p>
</div></body></html>`;

const cell = "padding: 6px 8px; border-bottom: 1px solid #e6ddcf; text-align: left;";

export function rfqEmail(input: {
  to: string;
  supplierName: string;
  lines: RequisitionLine[];
  neededBy: string | null;
  portalUrl: string;
  expiresAt: string;
}): MailMessage {
  const due = input.neededBy ? `Needed by ${input.neededBy}.` : "No fixed delivery date.";
  const expires = input.expiresAt.slice(0, 10);
  const lineText = input.lines
    .map((line) => `- ${line.itemName} (${line.sku}): ${formatQuantity(line.quantityRequested)} ${line.unitOfMeasure}`)
    .join("\n");
  return {
    to: input.to,
    subject: `Request for quotation: ${input.lines.map((line) => line.itemName).join(", ")}`,
    text: `Hello ${input.supplierName},\n\nWe would like a quotation for:\n${lineText}\n\n${due}\n\nSubmit your quote here (link valid until ${expires}):\n${input.portalUrl}\n`,
    html: shell(
      "Request for quotation",
      html`<p>Hello ${input.supplierName},</p>
<p>We would like a quotation for the items below. ${due}</p>
<table style="border-collapse: collapse; width: 100%;">
<tr><th style="${cell}">Item</th><th style="${cell}">SKU</th><th style="${cell}">Quantity</th></tr>
${input.lines.map(
  (line) =>
    html`<tr><td style="${cell}">${line.itemName}</td><td style="${cell}">${line.sku}</td><td style="${cell}">${formatQuantity(line.quantityRequested)} ${line.unitOfMeasure}</td></tr>`,
)}
</table>
<p style="margin: 24px 0;"><a href="${input.portalUrl}" style="background: #b5651d; color: #fff; padding: 10px 16px; text-decoration: none;">Submit your quote</a></p>
<p style="font-size: 13px; color: #6b5f50;">This link is personal to your company and valid until ${expires}. You can also decline from the same page.</p>`,
    ).value,
  };
}

export function purchaseOrderEmail(input: { to: string; po: PurchaseOrder; neededBy: string | null }): MailMessage {
  const { po } = input;
  const lineText = po.lines
    .map(
      (line) =>
        `- ${line.itemName}: ${formatQuantity(line.orderedQty)} x ${formatCents(line.unitPriceCents)} = ${formatCents(line.totalPriceCents)}`,
    )
    .join("\n");
  const delivery = input.neededBy ? `Please deliver by ${input.neededBy}.` : "";
  return {
    to: input.to,
    subject: `Purchase order ${po.poNumber}`,
    text: `Purchase order ${po.poNumber}\nSupplier: ${po.supplierName}\nIssued: ${po.issuedAt.slice(0, 10)}\n\n${lineText}\n\nTotal: ${formatCents(po.totalCents)}\n${delivery}\n\nPlease reference ${po.poNumber} on your delivery note and invoice.\n`,
    html: shell(
      `Purchase order ${po.poNumber}`,
      html`<p><strong>Supplier:</strong> ${po.supplierName}<br><strong>Issued:</strong> ${po.issuedAt.slice(0, 10)}<br><strong>Requisition:</strong> ${po.requisitionId}</p>
<table style="border-collapse: collapse; width: 100%;">
<tr><th style="${cell}">Item</th><th style="${cell}">Quantity</th><th style="${cell}">Unit price</th><th style="${cell}">Line total</th></tr>
${po.lines.map(
  (line) =>
    html`<tr><td style="${cell}">${line.itemName}</td><td style="${cell}">${formatQuantity(line.orderedQty)}</td><td style="${cell}">${formatCents(line.unitPriceCents)}</td><td style="${cell}">${formatCents(line.totalPriceCents)}</td></tr>`,
)}
<tr><td style="${cell}" colspan="3"><strong>Total</strong></td><td style="${cell}"><strong>${formatCents(po.totalCents)}</strong></td></tr>
</table>
<p>${delivery} Please reference <strong>${po.poNumber}</strong> on your delivery note and invoice.</p>`,
    ).value,
  };
}
