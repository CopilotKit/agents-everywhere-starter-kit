/**
 * AGENDA — dueño: P4.
 * buildMeeting() genera la agenda SOLO para los bloqueos `needs_meeting`.
 * La duración de cada punto sale de su complejidad (cuántos nodos frena),
 * no de un default de 30. El slot sale de disponibilidad fixture.
 */
import type { AgendaItem, Blocker, Meeting } from "./graph-types";

// TEMP: disponibilidad fixture propia — reemplazar si P5 entrega una real
// antes del checkpoint de 0:50.
const AVAILABILITY: { slot: string; available: string[] }[] = [
  {
    slot: "Hoy 15:00–15:30",
    available: ["Sofía Ramos", "Marta Quispe", "Luis Ferrari", "Ana Delgado"],
  },
  { slot: "Hoy 16:00–16:30", available: ["Sofía Ramos", "Ana Delgado"] },
  {
    slot: "Mañana 09:30–10:00",
    available: ["Marta Quispe", "Luis Ferrari", "Ana Delgado"],
  },
];

const MIN_ITEM_MINUTES = 15;
const MAX_ITEM_MINUTES = 30;
const MINUTES_PER_DEPENDENT = 5;

/** Más nodos dependen de esta decisión -> más minutos, con un techo. */
function minutesFor(blocker: Blocker): number {
  return Math.min(
    MIN_ITEM_MINUTES + blocker.blocks.length * MINUTES_PER_DEPENDENT,
    MAX_ITEM_MINUTES,
  );
}

/** El dueño del bloqueo, más los dueños de lo que ese bloqueo frena. */
function attendeesFor(blocker: Blocker, all: Blocker[]): string[] {
  const dependents = all.filter((b) => blocker.blocks.includes(b.id));
  return [blocker.owner, ...dependents.map((d) => d.owner)];
}

function pickSlot(attendees: string[]): string {
  const fullyAvailable = AVAILABILITY.find((slot) =>
    attendees.every((person) => slot.available.includes(person)),
  );
  if (fullyAvailable) return fullyAvailable.slot;
  // Nadie cubre a todos: gana el slot que cubre a más gente. Feo pero funciona.
  const bySize = [...AVAILABILITY].sort(
    (a, b) =>
      b.available.filter((p) => attendees.includes(p)).length -
      a.available.filter((p) => attendees.includes(p)).length,
  );
  return bySize[0]?.slot ?? "Por confirmar";
}

export async function buildMeeting(blockers: Blocker[]): Promise<Meeting> {
  const needsMeeting = blockers.filter((b) => b.status === "needs_meeting");

  const agenda: AgendaItem[] = needsMeeting.map((blocker) => ({
    topic: blocker.label,
    owner: blocker.owner,
    decision:
      blocker.resolution?.summary ||
      `Decidir el trade-off de "${blocker.label}" y desbloquear ${
        blocker.blocks.join(", ") || "al resto del proyecto"
      }.`,
    minutes: minutesFor(blocker),
  }));

  const attendees = [
    ...new Set(
      needsMeeting.flatMap((blocker) => attendeesFor(blocker, blockers)),
    ),
  ];
  const minutes = agenda.reduce((sum, item) => sum + item.minutes, 0);

  return { minutes, slot: pickSlot(attendees), agenda, attendees };
}
