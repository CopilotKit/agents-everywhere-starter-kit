import type { RequisitionStatus } from "procure-db/types";
import { useState } from "react";
import { Link } from "react-router";
import { fetchRequisitions } from "../api/client";
import { Lamp, Loaded } from "../components";
import { formatCents, formatDate, formatDay, formatLabel } from "../format";
import { useApi } from "../useApi";

const REQUISITION_STATUSES: RequisitionStatus[] = [
  "intake",
  "rfq_dispatched",
  "comparing",
  "pending_approval",
  "approved",
  "rejected",
  "po_issued",
  "closed",
];

export function RequisitionsList() {
  const [status, setStatus] = useState<RequisitionStatus | "">("");
  const state = useApi(() => fetchRequisitions(status || undefined), `requisitions:${status}`, { pollMs: 5000 });

  return (
    <>
      <h1>Requisitions</h1>
      <div className="filter-bar">
        <label>
          Status:{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value as RequisitionStatus | "")}>
            <option value="">All</option>
            {REQUISITION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Loaded
        state={state}
        noun="requisitions"
        isEmpty={(rows) => rows.length === 0}
        empty="No requisitions yet. Ask Procurebot for something →"
      >
        {(rows) => (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Waiting on</th>
                  <th>Needed by</th>
                  <th>Quotes</th>
                  <th>PO total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/requisitions/${row.id}`} className="record-link">
                        {row.summary ?? "Untitled request"}
                      </Link>
                    </td>
                    <td>
                      <Lamp status={row.status} />
                    </td>
                    <td>{formatLabel(row.waitingOn)}</td>
                    <td>{formatDay(row.neededBy)}</td>
                    <td>{row.suppliersInvited ? `${row.quotesReceived} / ${row.suppliersInvited}` : "—"}</td>
                    <td>{formatCents(row.poTotalCents)}</td>
                    <td>{formatDate(row.createdAt)}</td>
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
