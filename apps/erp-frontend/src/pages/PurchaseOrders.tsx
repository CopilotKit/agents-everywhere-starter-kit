import type { PoStatus } from "procure-db/types";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { fetchPurchaseOrderDetail, fetchPurchaseOrders } from "../api/client";
import { Lamp, Loaded } from "../components";
import { formatCents, formatDate, formatQty } from "../format";
import { useApi } from "../useApi";

export function PurchaseOrdersList() {
  const [status, setStatus] = useState<PoStatus | "">("");
  const state = useApi(() => fetchPurchaseOrders(status || undefined), `pos:${status}`, { pollMs: 5000 });
  return (
    <>
      <h1>Purchase orders</h1>
      <div className="filter-bar">
        <label>
          Status:{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value as PoStatus | "")}>
            <option value="">All</option>
            <option value="issued">Issued</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      <Loaded state={state} noun="purchase orders" isEmpty={(rows) => rows.length === 0}>
        {(rows) => (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Supplier</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Emailed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <Link to={`/purchase-orders/${po.id}`} className="record-link">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td>{po.supplierName}</td>
                    <td>{formatCents(po.totalCents)}</td>
                    <td>
                      <Lamp status={po.status} />
                    </td>
                    <td>{formatDate(po.issuedAt)}</td>
                    <td>{po.emailedAt ? formatDate(po.emailedAt) : (po.emailError ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}

export function PurchaseOrderDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const state = useApi(() => fetchPurchaseOrderDetail(id), `po:${id}`);
  return (
    <Loaded state={state} noun="purchase order">
      {(po) => (
        <article>
          <Link to="/purchase-orders" className="crumb">
            ← Back to purchase orders
          </Link>
          <h1>
            {po.poNumber}
            <span className="record-id">{po.supplierName}</span>
          </h1>
          <dl className="spec-sheet">
            <dt>Status</dt>
            <dd>
              <Lamp status={po.status} />
            </dd>
            <dt>Supplier</dt>
            <dd>
              <Link to={`/suppliers/${po.supplierId}`} className="record-link">
                {po.supplierName}
              </Link>
            </dd>
            <dt>Requisition</dt>
            <dd>
              <Link to={`/requisitions/${po.requisitionId}`} className="record-link">
                {po.requisitionId.slice(0, 8)}
              </Link>
            </dd>
            <dt>Issued</dt>
            <dd>{formatDate(po.issuedAt)}</dd>
            <dt>Emailed to supplier</dt>
            <dd>{po.emailedAt ? formatDate(po.emailedAt) : `Not sent${po.emailError ? `: ${po.emailError}` : ""}`}</dd>
            <dt>Total</dt>
            <dd>{formatCents(po.totalCents)}</dd>
          </dl>
          <section>
            <h2>Lines</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <Link to={`/items/${line.itemId}`} className="record-link">
                          {line.itemName}
                        </Link>
                      </td>
                      <td>{formatQty(line.orderedQty)}</td>
                      <td>{formatCents(line.unitPriceCents)}</td>
                      <td>{formatCents(line.totalPriceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </article>
      )}
    </Loaded>
  );
}
