import { Link, useParams } from "react-router";
import { fetchComparison, fetchRequisitionDetail } from "../api/client";
import { ComparisonTable, Lamp, Loaded } from "../components";
import { formatCents, formatDate, formatDay, formatLabel, formatQty } from "../format";
import { useApi } from "../useApi";

export function RequisitionDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const state = useApi(() => fetchRequisitionDetail(id), `requisition:${id}`, { pollMs: 4000 });
  const comparison = useApi(() => fetchComparison(id), `comparison:${id}`, { pollMs: 4000 });

  return (
    <Loaded state={state} noun="requisition">
      {(detail) => {
        const lineNames = new Map(detail.lines.map((line) => [line.id, line.itemName ?? line.rawDescription]));
        return (
          <article>
            <Link to="/" className="crumb">
              ← Back to requisitions
            </Link>
            <h1>
              {detail.lines.map((line) => line.itemName).join(", ") || "Requisition"}
              <span className="record-id">{detail.id.slice(0, 8)}</span>
            </h1>
            <dl className="spec-sheet">
              <dt>Status</dt>
              <dd>
                <Lamp status={detail.status} />
              </dd>
              <dt>Waiting on</dt>
              <dd>{formatLabel(detail.waitingOn)}</dd>
              <dt>Needed by</dt>
              <dd>{formatDay(detail.neededBy)}</dd>
              <dt>Requester</dt>
              <dd>{detail.requesterId}</dd>
              <dt>Created</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDate(detail.updatedAt)}</dd>
            </dl>

            <section>
              <h2>Line items</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Category</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.rawDescription}</td>
                        <td>
                          {line.itemId ? (
                            <Link to={`/items/${line.itemId}`} className="record-link">
                              {line.itemName}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{formatQty(line.quantityRequested, line.unitOfMeasure)}</td>
                        <td>{line.category ? formatLabel(line.category) : "—"}</td>
                        <td>
                          <Lamp status={line.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>RFQ &amp; invitations</h2>
              {detail.rfq === null ? (
                <p className="state-empty">No RFQ sent yet.</p>
              ) : (
                <>
                  <p className="state-line">Dispatched {formatDate(detail.rfq.dispatchedAt)}</p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Supplier</th>
                          <th>Status</th>
                          <th>Sent</th>
                          <th>Responded</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rfq.invitations.map((invitation) => (
                          <tr key={invitation.id}>
                            <td>
                              <Link to={`/suppliers/${invitation.supplierId}`} className="record-link">
                                {invitation.supplierName}
                              </Link>
                            </td>
                            <td>
                              <Lamp status={invitation.status} />
                            </td>
                            <td>{formatDate(invitation.sentAt)}</td>
                            <td>{invitation.respondedAt ? formatDate(invitation.respondedAt) : "—"}</td>
                            <td>{invitation.sendError ?? invitation.declineReason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section>
              <h2>Quotes</h2>
              {detail.quotes.length === 0 ? (
                <p className="state-empty">No quotes received yet.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Line total</th>
                        <th>Lead time</th>
                        <th>Terms</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.quotes.flatMap((quote) =>
                        quote.lines.map((line) => (
                          <tr key={line.id}>
                            <td>{quote.supplierName}</td>
                            <td>{lineNames.get(line.requisitionLineId) ?? "—"}</td>
                            <td>{formatQty(line.quantityQuoted, line.unit)}</td>
                            <td>{formatCents(line.unitPriceCents)}</td>
                            <td>{formatCents(line.totalPriceCents)}</td>
                            <td>{line.leadTimeDays === null ? "—" : `${line.leadTimeDays} days`}</td>
                            <td>{line.terms ?? "—"}</td>
                            <td>{formatDate(quote.submittedAt)}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {detail.quotes.length > 0 && comparison.data && (
              <section>
                <h2>Comparison</h2>
                <ComparisonTable comparison={comparison.data} />
              </section>
            )}

            <section>
              <h2>Approvals</h2>
              {detail.approvals.length === 0 ? (
                <p className="state-empty">No award approved yet.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Amount</th>
                        <th>Tier</th>
                        <th>Approved by</th>
                        <th>Status</th>
                        <th>Decided</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.approvals.map((approval) => (
                        <tr key={approval.id}>
                          <td>{formatCents(approval.amountCents)}</td>
                          <td>{approval.currentTier}</td>
                          <td>{approval.selectedBy ?? approval.assignedApproverId}</td>
                          <td>
                            <Lamp status={approval.status} />
                          </td>
                          <td>{approval.respondedAt ? formatDate(approval.respondedAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2>Purchase orders</h2>
              {detail.purchaseOrders.length === 0 ? (
                <p className="state-empty">No PO issued yet.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PO</th>
                        <th>Supplier</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Emailed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.purchaseOrders.map((po) => (
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
                          <td>{po.emailedAt ? formatDate(po.emailedAt) : (po.emailError ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </article>
        );
      }}
    </Loaded>
  );
}
