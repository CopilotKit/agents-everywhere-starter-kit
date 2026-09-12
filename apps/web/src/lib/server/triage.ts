/**
 * P3 · Triador. Classifies each dependency blocker and drafts its async
 * resolution in a single OpenRouter call. Local types mirror the Bloque 0
 * contract until P1's shared types file lands — swap the import then.
 */

export type BlockerKind =
  | "info_gap"
  | "confirmation"
  | "handoff"
  | "real_decision";

export type BlockerStatus =
  | "pending"
  | "resolving"
  | "resolved"
  | "needs_meeting";

export type Blocker = {
  id: string;
  label: string;
  owner: string;
  blocks: string[];
  kind: BlockerKind | null;
  status: BlockerStatus;
  resolution?: { summary: string; sources?: string[] };
  savedPersonHours: number;
};

const SYSTEM_PROMPT = `Sos el triador de Ruta Crítica. Por cada bloqueo de un
proyecto, decidís cómo se destraba SIN una reunión si es posible.

Categorías (kind):
- info_gap: nadie tiene el dato. Se resuelve con una búsqueda y un pre-read.
- confirmation: solo falta un sí/no de una persona. Se resuelve con un mensaje.
- handoff: es secuencia, no discusión. Se resuelve con una fecha y un aviso.
- real_decision: hay un trade-off real entre personas. Esto SÍ necesita reunión.

Para cada bloqueo devolvé: kind, un "summary" concreto (el texto exacto de
cómo se destraba async; para real_decision describí el trade-off en una
frase, no una resolución), "meetingMinutes" (duración que hubiera tenido la
reunión evitada) y "attendees" (personas que hubieran ido).

Respondé SOLO JSON con esta forma exacta, un elemento por bloqueo recibido,
en el mismo orden, usando el "id" recibido:
{"results":[{"id":"string","kind":"info_gap|confirmation|handoff|real_decision","summary":"string","meetingMinutes":number,"attendees":number}]}`;

type TriageResult = {
  id: string;
  kind: BlockerKind;
  summary: string;
  meetingMinutes: number;
  attendees: number;
};

/** Injectable so tests never hit the network. Returns the raw model text. */
export type ChatCompleter = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

async function defaultCompleter(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for triage.");
  const model = process.env.MODEL || "openai/gpt-4o-mini";
  const slug = model.includes("/") ? model : `openai/${model}`;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://aitinkerers.org",
      "X-OpenRouter-Title": process.env.APP_TITLE ?? "Agents, Everywhere",
    },
    body: JSON.stringify({
      model: slug,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response missing message content.");
  }
  return content;
}

function fallbackHours(minutes: number, attendees: number) {
  return Math.round((minutes / 60) * attendees * 10) / 10;
}

/** Safe default when the model call or parse fails: never crash the demo. */
function fallbackResults(blockers: Blocker[]): TriageResult[] {
  return blockers.map((b) => ({
    id: b.id,
    kind: "confirmation",
    summary: `Confirmar con ${b.owner} vía mensaje async.`,
    meetingMinutes: 30,
    attendees: 2,
  }));
}

function parseResults(raw: string, blockers: Blocker[]): TriageResult[] {
  const parsed = JSON.parse(raw);
  const results = parsed?.results;
  if (!Array.isArray(results) || results.length !== blockers.length) {
    throw new Error("Unexpected triage shape.");
  }
  const byId = new Map(results.map((r: any) => [r?.id, r]));
  return blockers.map((b) => {
    const r = byId.get(b.id);
    const kind: BlockerKind =
      r?.kind === "info_gap" ||
      r?.kind === "confirmation" ||
      r?.kind === "handoff" ||
      r?.kind === "real_decision"
        ? r.kind
        : "confirmation";
    return {
      id: b.id,
      kind,
      summary: typeof r?.summary === "string" ? r.summary : `Confirmar con ${b.owner}.`,
      meetingMinutes: typeof r?.meetingMinutes === "number" ? r.meetingMinutes : 30,
      attendees: typeof r?.attendees === "number" ? r.attendees : 2,
    };
  });
}

function applyResults(blockers: Blocker[], results: TriageResult[]): Blocker[] {
  const byId = new Map(results.map((r) => [r.id, r]));
  return blockers.map((b) => {
    const r = byId.get(b.id);
    if (!r) return b;
    const isMeeting = r.kind === "real_decision";
    return {
      ...b,
      kind: r.kind,
      status: isMeeting ? "needs_meeting" : "resolved",
      resolution: { summary: r.summary },
      savedPersonHours: isMeeting ? 0 : fallbackHours(r.meetingMinutes, r.attendees),
    };
  });
}

export async function triageBlockers(
  blockers: Blocker[],
  complete: ChatCompleter = defaultCompleter,
): Promise<Blocker[]> {
  if (blockers.length === 0) return blockers;
  const userPrompt = JSON.stringify(
    blockers.map((b) => ({
      id: b.id,
      label: b.label,
      owner: b.owner,
      blocks: b.blocks,
    })),
  );
  try {
    const raw = await complete(SYSTEM_PROMPT, userPrompt);
    const results = parseResults(raw, blockers);
    return applyResults(blockers, results);
  } catch {
    return applyResults(blockers, fallbackResults(blockers));
  }
}
