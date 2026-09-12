/**
 * FIXTURE — dueño: P5. P1 pushea esta forma para que nadie espere.
 * P5: reemplaza el contenido, NO la forma. Entregar antes de 0:50.
 *
 * Requisitos del fixture (esto es lo que hace creíble el demo):
 *  - 5 o 6 bloqueos
 *  - al menos uno de cada kind
 *  - nombres de personas, no "Persona A"
 *  - el info_gap tiene que dar pie a una búsqueda REAL en Exa:
 *    algo normativo o técnico con fuentes públicas
 */

import type { AppState, Blocker } from "./graph-types";

export const PROJECT = "Checkout v2 — lanzamiento 30 de septiembre";

export const blockers: Blocker[] = [
  {
    id: "pci",
    label: "Revisión PCI DSS del nuevo flujo de tarjeta",
    owner: "Sofía Ramos",
    blocks: ["pagos"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "db",
    label: "Migración de la tabla de órdenes",
    owner: "Marta Quispe",
    blocks: ["pagos"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "pagos",
    label: "API de Pagos v3",
    owner: "Luis Ferrari",
    blocks: ["checkout"],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  {
    id: "checkout",
    label: "Checkout v2",
    owner: "Ana Delgado",
    blocks: [],
    kind: null,
    status: "pending",
    savedPersonHours: 0,
  },
  // P5: faltan 1-2 más. Uno tiene que ser claramente un handoff.
];

export const initialState: AppState = {
  project: PROJECT,
  blockers,
  totals: { before: 0, after: 0, saved: 0 },
};

/** Lo que ve el agente como contexto de página. */
export function graphContext(state: AppState) {
  return {
    project: state.project,
    blockers: state.blockers.map((b) => ({
      id: b.id,
      label: b.label,
      owner: b.owner,
      blocks: b.blocks,
      kind: b.kind,
      status: b.status,
      resolution: b.resolution ?? null,
    })),
    totals: state.totals,
    meeting: state.meeting ?? null,
  };
}
