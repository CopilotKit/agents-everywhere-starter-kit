import type { QuoteComparison } from "procure-db/types";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ApiState } from "./useApi";
import { formatCents, formatDay, formatLabel } from "./format";
import { statusTone } from "./statusTone";

export function Lamp({ status, to }: { status: string; to?: string }) {
  const className = `lamp lamp--${statusTone(status)}`;
  return to ? (
    <Link to={to} className={className}>
      {formatLabel(status)}
    </Link>
  ) : (
    <span className={className}>{formatLabel(status)}</span>
  );
}

/** Loading / error / empty handling shared by every page. */
export function Loaded<T>({
  state,
  noun,
  isEmpty,
  empty,
  children,
}: {
  state: ApiState<T>;
  noun: string;
  isEmpty?: (data: T) => boolean;
  empty?: string;
  children: (data: T) => ReactNode;
}) {
  if (state.error && !state.data) return <p role="alert">{state.error}</p>;
  if (!state.data) return <p className="state-line">Loading {noun}…</p>;
  if (isEmpty?.(state.data)) return <p className="state-empty">{empty ?? `No ${noun} yet.`}</p>;
  return <>{children(state.data)}</>;
}

const deadlineLabel = (meets: boolean | null) => (meets === null ? "—" : meets ? "On time" : "Late");

/** `compact` drops rank and delivery-date columns for the narrow chat column. */
export function ComparisonTable({ comparison, compact = false }: { comparison: QuoteComparison; compact?: boolean }) {
  if (comparison.rows.length === 0) return <p className="state-empty">No quotes received yet.</p>;
  return (
    <>
      <div className="table-scroll">
        <table className="comparison">
          <thead>
            <tr>
              {!compact && <th>Rank</th>}
              <th>Supplier</th>
              <th>Total</th>
              <th>Lead time</th>
              {!compact && <th>Est. delivery</th>}
              <th>{compact ? "On time" : `Needed by ${formatDay(comparison.neededBy)}`}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row, index) => (
              <tr key={row.quoteId} className={row.quoteId === comparison.recommendedQuoteId ? "is-recommended" : undefined}>
                {!compact && <td>{index + 1}</td>}
                <td>
                  {row.supplierName}
                  {row.quoteId === comparison.recommendedQuoteId && <span className="badge">Recommended</span>}
                </td>
                <td>{row.complete ? formatCents(row.totalCents) : "Incomplete"}</td>
                <td>{row.leadTimeDays === null ? "—" : `${row.leadTimeDays} days`}</td>
                {!compact && <td>{formatDay(row.estimatedDelivery)}</td>}
                <td>
                  <span className={`lamp lamp--${row.meetsDeadline === false ? "negative" : row.meetsDeadline ? "positive" : "neutral"}`}>
                    {deadlineLabel(row.meetsDeadline)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="comparison__reason">{comparison.reason}</p>
    </>
  );
}
