# Propiedad de archivos — Ruta Crítica
Cada persona toca SOLO sus archivos. Si necesitas algo de otro, lo pides.
Rutas relativas a `apps/web/`.

| Dueño | Archivos |
|---|---|
| **P1 (gandy)** | `src/lib/graph-types.ts` · `src/lib/use-graph.ts` · `src/components/app-control.tsx` · `src/app/page.tsx` · `src/app/api/copilotkit/[[...path]]/route.ts` · `.env` · merges a `main` |
| **P2 Grafo** | `src/components/graph-canvas.tsx` (nuevo) · `src/app/globals.css` |
| **P3 Triador** | `src/lib/triage-prompt.ts` (nuevo) · `src/app/api/triage/route.ts` (nuevo, si hace falta) |
| **P4 Exa + salidas** | `src/app/api/search/route.ts` (ya existe, ampliar) · `src/lib/agenda.ts` (nuevo) · `src/components/workplace-followups.tsx` |
| **P5 Datos + demo** | `src/lib/fixture.ts` · `SUBMISSION.md` · guion y video |

## Archivos que NADIE toca
`src/lib/server/workplace.ts` · `src/lib/server/followups.ts` · `src/app/api/followups/route.ts`
Son la frontera de escritura del starter kit. Funcionan. Romperlos cuesta el criterio de ejecución técnica.

## Borrar sin miedo
`src/lib/incidents.ts` y sus referencias. Es el dominio de ejemplo; el reglamento dice explícitamente que renombrar la demo provista no constituye un proyecto nuevo.
