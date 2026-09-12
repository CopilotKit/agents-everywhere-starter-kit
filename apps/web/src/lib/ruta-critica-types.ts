/**
 * TEMP: local copy of the Bloque 0 type contract, owned by P1.
 * Delete this file and import from P1's real shared types once pushed to main.
 */
export type Blocker = {
  id: string;
  label: string;
  owner: string;
  blocks: string[];
  kind: "info_gap" | "confirmation" | "handoff" | "real_decision" | null;
  status: "pending" | "resolving" | "resolved" | "needs_meeting";
  resolution?: { summary: string; sources?: string[] };
  savedPersonHours: number;
};

export type AgendaItem = {
  topic: string;
  owner: string;
  expectedDecision: string;
  minutes: number;
};

export type Meeting = {
  minutes: number;
  slot: string;
  agenda: AgendaItem[];
  attendees: string[];
};
