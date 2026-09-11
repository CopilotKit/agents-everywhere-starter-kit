import React from "react";

// Tool arguments arrive incrementally, before schema defaults are applied.
export interface IncidentCardProps {
  headline?: string;
  summary?: string;
  facts?: Array<{ label?: string; value?: string } | null> | null;
  nextSteps?: Array<string | null> | null;
  tone?: string;
}

export interface TimelineProps {
  title?: string;
  columns?: Array<string | null> | null;
  rows?: Array<Array<string | null> | null> | null;
}

const toneColor = {
  neutral: "var(--ae-muted)",
  good: "#2e7d5b",
  attention: "var(--ae-accent)",
} as const;

export function IncidentCard({
  headline,
  summary,
  facts,
  nextSteps,
  tone,
}: IncidentCardProps) {
  const color =
    tone === "good" || tone === "attention"
      ? toneColor[tone]
      : toneColor.neutral;
  return (
    <article className="ck-card" style={{ borderLeftColor: color }}>
      <h3>{headline || "Preparing incident assessment…"}</h3>
      <p>{summary || "Gathering incident details…"}</p>
      {!!facts?.length && (
        <dl className="ck-facts">
          {facts.map((fact, index) => (
            <div key={index}>
              <dt>{fact?.label || "Loading…"}</dt>
              <dd>{fact?.value || "Loading…"}</dd>
            </div>
          ))}
        </dl>
      )}
      {!!nextSteps?.length && (
        <ul className="ck-steps">
          {nextSteps.map((step, index) => (
            <li key={index}>{step || "Loading…"}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Timeline({ title, columns, rows }: TimelineProps) {
  return (
    <article className="ck-card">
      {title && <h3>{title}</h3>}
      {!columns?.length ? (
        <p>Preparing timeline…</p>
      ) : (
        <div className="ck-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((header, index) => (
                  <th key={index}>{header || "Loading…"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows?.length ? (
                <tr>
                  <td colSpan={columns.length}>Loading events…</td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((_, cellIndex) => (
                      <td key={cellIndex}>{row?.[cellIndex] ?? "Loading…"}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
