"use client";
/**
 * PÁGINA — dueño: P1. Nadie más la edita.
 * Heredado del starter kit: layout ck-*, CopilotChat, GenerativeUI,
 * WorkplaceFollowups y el hook useWorkplace.
 * Construido hoy: el estado del grafo, la lista de bloqueos y el contador.
 */

import { CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { AppControl } from "@/components/app-control";
import { GraphCanvas, SavedHours } from "@/components/graph-canvas";
import { WorkplaceFollowups } from "@/components/workplace-followups";
import { useWorkplace } from "@/lib/use-workplace";
import { useGraph } from "@/lib/use-graph";

/** Ancla de los registros en Ambiguous. Un proyecto = un hilo. */
const PROJECT_ID = "checkout-v2";

export default function Home() {
  const graph = useGraph();
  const workplace = useWorkplace(PROJECT_ID);
  const { state } = graph;

  useConfigureSuggestions(
    {
      suggestions: [
        {
          title: "¿Qué me está frenando?",
          message:
            "¿Qué me está frenando para lanzar este proyecto? Mapea la cadena de bloqueos y clasifícalos.",
        },
        {
          title: "Resuelve lo que se pueda async",
          message:
            "Resuelve async todo lo que no necesite una reunión. Para los info_gap, investiga y adjunta un pre-read con fuentes.",
        },
        {
          title: "Solo lo irreducible",
          message:
            "¿Qué queda que de verdad necesite juntar gente? Prepara la reunión mínima con agenda y decisión esperada por punto.",
        },
      ],
      available: "before-first-message",
    },
    [],
  );

  return (
    <>
      <GenerativeUI />
      <AppControl graph={graph} workplace={workplace} />

      <main className="ck-workspace">
        <header className="ck-workspace-header">
          <div>
            <p className="ck-eyebrow">Agents, everywhere · Ruta Crítica</p>
            <h1>{state.project}</h1>
            <p className="ck-intro">
              El agente no agenda reuniones: las elimina. Solo lo irreducible
              llega a ser una reunión.
            </p>
          </div>
          <span className="ck-tag">Datos seeded</span>
        </header>

        <div className="ck-workspace-grid">
          <section className="ck-panel" aria-labelledby="graph-title">
            <h2 id="graph-title" style={{ marginTop: 0 }}>
              Cadena de bloqueos
            </h2>

            <SavedHours state={state} />

            <div style={{ marginTop: 14 }}>
              <GraphCanvas state={state} />
            </div>

            {state.meeting && (
              <div style={{ marginTop: 16 }}>
                <h3>Reunión mínima viable</h3>
                <p style={{ fontSize: ".88rem", opacity: 0.8 }}>
                  {state.meeting.minutes} min · {state.meeting.slot} ·{" "}
                  {state.meeting.attendees.join(", ")}
                </p>
                <ol style={{ fontSize: ".9rem" }}>
                  {state.meeting.agenda.map((item) => (
                    <li key={item.topic}>
                      <strong>{item.topic}</strong> — {item.owner} ·{" "}
                      {item.minutes} min
                      <br />
                      <span style={{ opacity: 0.75 }}>
                        Decisión esperada: {item.decision}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <WorkplaceFollowups incidentId={PROJECT_ID} workplace={workplace} />
          </section>

          <section
            className="ck-panel ck-assistant"
            aria-labelledby="assistant-title"
          >
            <header className="ck-assistant-header">
              <h2 id="assistant-title">Ruta Crítica</h2>
              <p>Lee esta página, clasifica los bloqueos y mata las reuniones evitables.</p>
            </header>
            <CopilotChat
              className="ck-chat"
              labels={{
                welcomeMessageText: "¿Qué te está frenando?",
                chatInputPlaceholder: "Pregunta por la cadena de bloqueos…",
              }}
            />
          </section>
        </div>
      </main>
    </>
  );
}
