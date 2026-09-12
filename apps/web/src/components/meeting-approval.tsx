"use client";
/**
 * APPROVAL CARD — dueño: P4.
 * Nada de esto llama a ningún proveedor externo: es la reunión mínima
 * viable que build_meeting() propuso, y un humano decide si se confirma.
 * Aprobar/Cancelar es estado local — el alcance congelado no incluye
 * Calendar real.
 */
import { useState } from "react";
import type { Meeting } from "@/lib/graph-types";

export function MeetingApproval({ meeting }: { meeting: Meeting }) {
  const [status, setStatus] = useState<"pending" | "approved" | "cancelled">(
    "pending",
  );
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState(meeting.slot);

  if (status === "cancelled") {
    return (
      <section className="ck-approval" aria-label="Reunión cancelada">
        <h3>Reunión mínima viable — cancelada</h3>
        <p className="ck-local-note">
          Los bloqueos que la necesitaban siguen en needs_meeting.
        </p>
      </section>
    );
  }

  return (
    <section className="ck-approval" aria-label="Aprobar reunión">
      <h3>Reunión mínima viable</h3>
      <p style={{ fontSize: ".88rem", opacity: 0.8 }}>
        {meeting.minutes} min ·{" "}
        {editing ? (
          <input
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            style={{ font: "inherit", width: "auto" }}
          />
        ) : (
          slot
        )}{" "}
        · {meeting.attendees.join(", ")}
      </p>
      <ol style={{ fontSize: ".9rem" }}>
        {meeting.agenda.map((item) => (
          <li key={item.topic}>
            <strong>{item.topic}</strong> — {item.owner} · {item.minutes} min
            <br />
            <span style={{ opacity: 0.75 }}>
              Decisión esperada: {item.decision}
            </span>
          </li>
        ))}
      </ol>

      {status === "approved" ? (
        <p role="status" className="ck-notice">
          Reunión aprobada para {slot}. Nadie fue citado sin que un humano lo
          confirmara.
        </p>
      ) : (
        <div className="ck-approval-actions">
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={() => setStatus("approved")}
          >
            Aprobar
          </button>
          <button type="button" className="ck-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? "Listo" : "Editar"}
          </button>
          <button
            type="button"
            className="ck-btn"
            onClick={() => setStatus("cancelled")}
          >
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
