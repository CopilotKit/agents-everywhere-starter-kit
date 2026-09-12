"use client";
/**
 * GRAFO — dueño: P2.
 * P1 deja este placeholder funcionando para que page.tsx compile desde el
 * minuto 0. P2: reemplaza TODO el interior. No cambies la firma del props
 * ni toques page.tsx — si necesitas otro campo, se lo pides a P1.
 */

import { STATUS_COLOR, KIND_LABEL, type AppState } from "@/lib/graph-types";

export function GraphCanvas({ state }: { state: AppState }) {
  const byId = new Map(state.blockers.map((b) => [b.id, b]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {state.blockers.map((b) => (
        <div
          key={b.id}
          style={{
            borderLeft: `4px solid ${STATUS_COLOR[b.status]}`,
            border: "1px solid rgba(128,128,128,.28)",
            borderLeftWidth: 4,
            borderLeftColor: STATUS_COLOR[b.status],
            borderRadius: 4,
            padding: "12px 14px",
            transition: "border-color .35s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: ".95rem" }}>{b.label}</strong>
            <span style={{ fontSize: ".8rem", opacity: 0.7 }}>{b.owner}</span>
            {b.kind && (
              <span
                style={{
                  fontSize: ".68rem",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: STATUS_COLOR[b.status],
                  fontWeight: 700,
                }}
              >
                {KIND_LABEL[b.kind]}
              </span>
            )}
          </div>

          {b.blocks.length > 0 && (
            <div style={{ fontSize: ".78rem", opacity: 0.65, marginTop: 4 }}>
              bloquea → {b.blocks.map((id) => byId.get(id)?.label ?? id).join(", ")}
            </div>
          )}

          {b.resolution && (
            <div style={{ fontSize: ".86rem", marginTop: 8, opacity: 0.9 }}>
              <p style={{ margin: 0 }}>{b.resolution.summary}</p>
              {b.resolution.sources && b.resolution.sources.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: "1.1em" }}>
                  {b.resolution.sources.map((s) => (
                    <li key={s.url} style={{ fontSize: ".8rem" }}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** El número grande del cierre del demo. */
export function SavedHours({ state }: { state: AppState }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        padding: "14px 16px",
        border: "1px solid rgba(128,128,128,.28)",
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontSize: "2.6rem",
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-.03em",
          color: STATUS_COLOR.resolved,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {state.totals.saved.toFixed(1)}
      </span>
      <span style={{ fontSize: ".85rem", opacity: 0.75 }}>
        horas-persona recuperadas
        <br />
        de {state.totals.before.toFixed(1)} h de coordinación
      </span>
    </div>
  );
}
