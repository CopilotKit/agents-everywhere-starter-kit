"use client";
/**
 * TOOLS DEL AGENTE — dueño: P1. Reemplaza apps/web/src/components/app-control.tsx
 *
 * Heredado del starter kit: la forma de useAgentContext/useFrontendTool,
 * toolResult, y las tools de Ambiguous (propose/retrieve/refresh).
 * Construido hoy: map_dependencies, triage_blockers, research_blocker,
 * propose_resolution.
 *
 * REGLA QUE NO SE ROMPE: el chat nunca recibe tools de escritura crudas.
 * Propone y lee; el servidor escribe solo tras el clic de aprobar.
 */

import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { graphContext } from "@/lib/fixture";
import { KIND_LABEL } from "@/lib/graph-types";
import type { GraphControls, TriageVerdict } from "@/lib/use-graph";
import type { WorkplaceControls } from "@/lib/use-workplace";

async function toolResult<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "La operación falló. Revisa la página para el detalle.",
    };
  }
}

export function AppControl({
  graph,
  workplace,
}: {
  graph: GraphControls;
  workplace: WorkplaceControls;
}) {
  const { status, propose, retrieve } = workplace;
  const { state, applyTriage, attachResolution, setResolving } = graph;

  useAgentContext({
    description:
      "El proyecto y su cadena de bloqueos, tal como el usuario los ve ahora. " +
      "Tu trabajo NO es agendar reuniones: es eliminarlas. Cada bloqueo se " +
      "clasifica en info_gap, confirmation, handoff o real_decision. Los tres " +
      "primeros se resuelven async. Solo real_decision llega a ser reunión. " +
      "CRÍTICO: propose_resolution solo prepara una propuesta. Únicamente el " +
      "botón de aprobación del usuario guarda algo; aprobar por chat nunca " +
      "ejecuta una escritura. Nunca afirmes que algo se guardó sin un registro " +
      "real. Nunca inventes links de registro.",
    value: {
      ...graphContext(state),
      workplace: status?.status ?? "unavailable",
      workplaceError: workplace.error,
      proposal: workplace.proposal ?? null,
      lastResult: workplace.notice,
    },
  });

  // ---- P1 ----
  useFrontendTool(
    {
      name: "map_dependencies",
      description:
        "Devuelve la cadena de bloqueos del proyecto visible, con dueño y estado actual. Úsala primero, antes de clasificar.",
      parameters: z.object({}),
      handler: async () => graphContext(state),
    },
    [state],
  );

  // ---- P3: el Triador. UNA llamada, todos los nodos. ----
  useFrontendTool(
    {
      name: "triage_blockers",
      description:
        "Clasifica TODOS los bloqueos pendientes de una sola vez y devuelve el veredicto de cada uno. " +
        `Tipos: ${Object.entries(KIND_LABEL).map(([k, v]) => `${k} (${v})`).join(", ")}. ` +
        "savedPersonHours son las horas-persona que se ahorran al no hacer la reunión que ese bloqueo habría provocado; " +
        "para real_decision es 0 porque la reunión sí ocurre.",
      parameters: z.object({
        verdicts: z.array(
          z.object({
            id: z.string(),
            kind: z.enum([
              "info_gap",
              "confirmation",
              "handoff",
              "real_decision",
            ]),
            summary: z.string().min(1).max(600),
            savedPersonHours: z.number().min(0).max(40),
          }),
        ),
      }),
      handler: async ({ verdicts }) => {
        applyTriage(verdicts as TriageVerdict[]);
        return {
          status: "applied",
          applied: verdicts.length,
          note: "El grafo ya refleja la clasificación. Ahora resuelve los info_gap con research_blocker.",
        };
      },
    },
    [applyTriage],
  );

  // ---- P4: Exa ----
  useFrontendTool(
    {
      name: "research_blocker",
      description:
        "Solo para bloqueos kind=info_gap. Busca evidencia pública y genera un pre-read con fuentes citadas que ELIMINA la necesidad de reunirse. Devuelve el resumen y las URLs reales; nunca inventes fuentes.",
      parameters: z.object({
        blockerId: z.string(),
        query: z.string().min(3).max(300),
      }),
      handler: async ({ blockerId, query }) =>
        toolResult(async () => {
          setResolving(blockerId);
          const res = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, results: 3 }),
          });
          if (!res.ok) throw new Error(`Búsqueda falló: HTTP ${res.status}`);
          const { results } = (await res.json()) as {
            results: { title?: string; url?: string; text?: string }[];
          };
          const sources = (results ?? [])
            .filter((r) => r.url)
            .map((r) => ({ title: r.title ?? r.url!, url: r.url! }));
          return { blockerId, sources, raw: results };
        }),
    },
    [setResolving],
  );

  useFrontendTool(
    {
      name: "attach_preread",
      description:
        "Adjunta el pre-read redactado al bloqueo y lo marca resuelto en el grafo. Usa solo fuentes devueltas por research_blocker.",
      parameters: z.object({
        blockerId: z.string(),
        summary: z.string().min(1).max(2000),
        sources: z.array(z.object({ title: z.string(), url: z.string() })),
      }),
      handler: async ({ blockerId, summary, sources }) => {
        attachResolution(blockerId, { summary, sources });
        return { status: "resolved", blockerId };
      },
    },
    [attachResolution],
  );

  // ---- Heredado del kit: la frontera de escritura. NO TOCAR la lógica. ----
  useFrontendTool(
    {
      name: "propose_resolution",
      description:
        "Prepara un registro con la resolución de un bloqueo para que el usuario la apruebe. NO guarda nada. CRÍTICO: espera a que el usuario haga clic en el botón de aprobación de la página.",
      parameters: z.object({
        incidentId: z.string(),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().min(1).max(4000),
      }),
      handler: async (draft) =>
        toolResult(async () => ({
          status: "pending_approval",
          proposal: await propose(draft),
        })),
    },
    [propose],
  );

  useFrontendTool(
    {
      name: "retrieve_followup",
      description:
        "Recupera un registro guardado por su ID real. Solo lectura; nunca crea duplicados.",
      parameters: z.object({ id: z.string() }),
      handler: async ({ id }) => toolResult(() => retrieve(id)),
    },
    [retrieve],
  );

  useFrontendTool(
    {
      name: "refresh_followups",
      description:
        "Lee los registros guardados desde el proveedor. Úsala después de aprobar o de refrescar el navegador para verificar persistencia.",
      parameters: z.object({}),
      handler: async () => toolResult(() => workplace.refresh()),
    },
    [workplace.refresh],
  );

  return null;
}
