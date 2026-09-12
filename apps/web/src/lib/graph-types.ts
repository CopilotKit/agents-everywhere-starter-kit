/**
 * CONTRATO DE TIPOS — Ruta Crítica
 * Dueño: P1. Nadie edita este archivo sin avisar en voz alta.
 * Todos codean contra esto desde el minuto 0.
 */

export type BlockerKind =
  | "info_gap"        // nadie sabe la respuesta  -> Exa -> pre-read
  | "confirmation"    // solo falta un sí/no      -> mensaje
  | "handoff"         // secuencia entre equipos  -> propuesta de fecha
  | "real_decision";  // trade-off real           -> REUNIÓN

export type BlockerStatus =
  | "pending"
  | "resolving"
  | "resolved"
  | "needs_meeting";

export type Resolution = {
  summary: string;
  sources?: { title: string; url: string }[];
};

export type Blocker = {
  id: string;
  label: string;
  owner: string;
  blocks: string[];           // ids de los nodos que este bloqueo frena
  kind: BlockerKind | null;   // null = todavía no triado
  status: BlockerStatus;
  resolution?: Resolution;
  savedPersonHours: number;   // 0 hasta que se resuelve
};

export type AgendaItem = {
  topic: string;
  owner: string;
  decision: string;           // la decisión esperada, no "discutir X"
  minutes: number;
};

export type Meeting = {
  minutes: number;
  slot: string;
  agenda: AgendaItem[];
  attendees: string[];
};

export type Totals = {
  before: number;   // horas-persona de coordinación sin el agente
  after: number;    // horas-persona que quedan
  saved: number;    // before - after  (el número grande del demo)
};

export type AppState = {
  project: string;
  blockers: Blocker[];
  meeting?: Meeting;
  totals: Totals;
};

/* ---------- helpers compartidos ---------- */

export const KIND_LABEL: Record<BlockerKind, string> = {
  info_gap: "Falta información",
  confirmation: "Falta confirmación",
  handoff: "Handoff / secuencia",
  real_decision: "Decisión con trade-off",
};

/** Única fuente de verdad del color. P2 usa esto, no hardcodea. */
export const STATUS_COLOR: Record<BlockerStatus, string> = {
  pending: "#66727f",
  resolving: "#8a6111",
  resolved: "#16706a",
  needs_meeting: "#9d3617",
};

/** kind -> status destino. P3 no decide status, decide kind. */
export function statusForKind(kind: BlockerKind): BlockerStatus {
  return kind === "real_decision" ? "needs_meeting" : "resolved";
}

/** El contador del demo. P3 es dueño de los números, P1 del cálculo. */
export function computeTotals(blockers: Blocker[]): Totals {
  const before = blockers.length * 1.5 * 3; // 1 reunión de 1.5h por bloqueo, 3 personas
  const saved = blockers.reduce((sum, b) => sum + (b.savedPersonHours ?? 0), 0);
  return { before, after: Math.max(before - saved, 0), saved };
}
