"use client";
/**
 * SHARED STATE — dueño: P1.
 * P2 lee `state` y pinta. P3 no toca esto: devuelve JSON y P1 lo aplica.
 */

import { useCallback, useState } from "react";
import {
  computeTotals,
  statusForKind,
  type AppState,
  type BlockerKind,
  type Meeting,
  type Resolution,
} from "./graph-types";
import { initialState } from "./fixture";

export type TriageVerdict = {
  id: string;
  kind: BlockerKind;
  summary: string;
  savedPersonHours: number;
};

export function useGraph() {
  const [state, setState] = useState<AppState>(() => ({
    ...initialState,
    totals: computeTotals(initialState.blockers),
  }));

  /** P3 devuelve TODOS los veredictos en una sola llamada. Se aplican juntos. */
  const applyTriage = useCallback((verdicts: TriageVerdict[]) => {
    setState((prev) => {
      const byId = new Map(verdicts.map((v) => [v.id, v]));
      const blockers = prev.blockers.map((b) => {
        const v = byId.get(b.id);
        if (!v) return b;
        return {
          ...b,
          kind: v.kind,
          status: statusForKind(v.kind),
          savedPersonHours:
            v.kind === "real_decision" ? 0 : v.savedPersonHours,
          resolution: { summary: v.summary },
        };
      });
      return { ...prev, blockers, totals: computeTotals(blockers) };
    });
  }, []);

  /** P4: el pre-read de Exa entra por aquí. */
  const attachResolution = useCallback(
    (id: string, resolution: Resolution) => {
      setState((prev) => {
        const blockers = prev.blockers.map((b) =>
          b.id === id ? { ...b, status: "resolved" as const, resolution } : b,
        );
        return { ...prev, blockers, totals: computeTotals(blockers) };
      });
    },
    [],
  );

  const setResolving = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      blockers: prev.blockers.map((b) =>
        b.id === id ? { ...b, status: "resolving" as const } : b,
      ),
    }));
  }, []);

  const setMeeting = useCallback((meeting: Meeting) => {
    setState((prev) => ({ ...prev, meeting }));
  }, []);

  return { state, applyTriage, attachResolution, setResolving, setMeeting };
}

export type GraphControls = ReturnType<typeof useGraph>;
