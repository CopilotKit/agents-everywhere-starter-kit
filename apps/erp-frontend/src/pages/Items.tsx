import { useState } from "react";
import { Link, useParams } from "react-router";
import { fetchItemDetail, fetchItems } from "../api/client";
import { Lamp, Loaded } from "../components";
import { formatCents, formatDate, formatLabel, formatQty } from "../format";
import { useApi } from "../useApi";
import { CategoryFilter } from "./Suppliers";

export function ItemsList() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const state = useApi(
    () => fetchItems({ category: category || undefined, query: search.trim() || undefined }),
    `items:${category}:${search.trim()}`,
  );
  return (
    <>
      <h1>Items</h1>
      <div className="filter-bar">
        <CategoryFilter value={category} onChange={setCategory} />
        <label>
          Search:{" "}
          <input className="filter-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="pens" />
        </label>
      </div>
      <Loaded state={state} noun="items" isEmpty={(rows) => rows.length === 0} empty="No matching items.">
        {(rows) => (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>On hand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.sku ?? "—"}</td>
                    <td>
                      <Link to={`/items/${item.id}`} className="record-link">
                        {item.name}
                      </Link>
                    </td>
                    <td>{item.category ? formatLabel(item.category) : "—"}</td>
                    <td>{item.unitOfMeasure}</td>
                    <td>{formatQty(item.quantityOnHand)}</td>
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

export function ItemDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const state = useApi(() => fetchItemDetail(id), `item:${id}`);
  return (
    <Loaded state={state} noun="item">
      {(item) => (
        <article>
          <Link to="/items" className="crumb">
            ← Back to items
          </Link>
          <h1>
            {item.name}
            <span className="record-id">{item.sku}</span>
          </h1>
          <dl className="spec-sheet">
            <dt>Description</dt>
            <dd>{item.description ?? "—"}</dd>
            <dt>Category</dt>
            <dd>{item.category ? formatLabel(item.category) : "—"}</dd>
            <dt>Unit</dt>
            <dd>{item.unitOfMeasure}</dd>
            <dt>On hand</dt>
            <dd>{formatQty(item.quantityOnHand, item.unitOfMeasure)}</dd>
          </dl>
          <section>
            <h2>Requested in</h2>
            {item.requisitionLines.length === 0 ? (
              <p className="state-empty">Never requested.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Requisition</th>
                      <th>Request</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.requisitionLines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <Link to={`/requisitions/${line.requisitionId}`} className="record-link">
                            {line.requisitionId.slice(0, 8)}
                          </Link>
                        </td>
                        <td>{line.rawDescription}</td>
                        <td>{formatQty(line.quantityRequested)}</td>
                        <td>
                          <Lamp status={line.status} />
                        </td>
                        <td>{formatDate(line.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2>Ordered on</h2>
            {item.poLines.length === 0 ? (
              <p className="state-empty">Never ordered.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>PO</th>
                      <th>Supplier</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Total</th>
                      <th>Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.poLines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <Link to={`/purchase-orders/${line.poId}`} className="record-link">
                            {line.poNumber}
                          </Link>
                        </td>
                        <td>{line.supplierName}</td>
                        <td>{formatQty(line.orderedQty)}</td>
                        <td>{formatCents(line.unitPriceCents)}</td>
                        <td>{formatCents(line.totalPriceCents)}</td>
                        <td>{formatDate(line.issuedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </article>
      )}
    </Loaded>
  );
}
