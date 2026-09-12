import { useState } from "react";
import { Link, useParams } from "react-router";
import { fetchCategories, fetchSupplierDetail, fetchSuppliers } from "../api/client";
import { Lamp, Loaded } from "../components";
import { formatCategories, formatDate, formatLabel } from "../format";
import { useApi } from "../useApi";

export function CategoryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const categories = useApi(fetchCategories, "categories");
  return (
    <label>
      Category:{" "}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {(categories.data ?? []).map((category) => (
          <option key={category} value={category}>
            {formatLabel(category)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SuppliersList() {
  const [category, setCategory] = useState("");
  const state = useApi(() => fetchSuppliers(category || undefined), `suppliers:${category}`);
  return (
    <>
      <h1>Suppliers</h1>
      <div className="filter-bar">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>
      <Loaded state={state} noun="suppliers" isEmpty={(rows) => rows.length === 0}>
        {(rows) => (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Email</th>
                  <th>Categories</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <Link to={`/suppliers/${supplier.id}`} className="record-link">
                        {supplier.name}
                      </Link>
                    </td>
                    <td>{supplier.email ?? "—"}</td>
                    <td>{formatCategories(supplier.categories)}</td>
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

export function SupplierDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const state = useApi(() => fetchSupplierDetail(id), `supplier:${id}`);
  return (
    <Loaded state={state} noun="supplier">
      {(supplier) => (
        <article>
          <Link to="/suppliers" className="crumb">
            ← Back to suppliers
          </Link>
          <h1>{supplier.name}</h1>
          <dl className="spec-sheet">
            <dt>Email</dt>
            <dd>{supplier.email ?? "—"}</dd>
            <dt>Categories</dt>
            <dd>{formatCategories(supplier.categories)}</dd>
          </dl>
          <section>
            <h2>RFQ history</h2>
            {supplier.invitations.length === 0 ? (
              <p className="state-empty">Not invited to any RFQ yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Requisition</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.invitations.map((invitation) => (
                      <tr key={invitation.invitationId}>
                        <td>
                          <Link to={`/requisitions/${invitation.requisitionId}`} className="record-link">
                            {invitation.requisitionId.slice(0, 8)}
                          </Link>
                        </td>
                        <td>
                          <Lamp status={invitation.status} />
                        </td>
                        <td>{formatDate(invitation.sentAt)}</td>
                        <td>{invitation.quoteId ? "Received" : "—"}</td>
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
