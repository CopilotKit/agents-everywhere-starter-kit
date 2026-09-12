/**
 * Runtime del agente web. Dueño: P1.
 * Heredado del starter kit: toda la estructura Hono y las dos advertencias.
 * Construido hoy: el prompt propio de Ruta Crítica.
 *
 * NO declarar `channels` aquí. NO reusar una instancia de agente entre requests.
 */
import { randomUUID } from "node:crypto";
import {
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";
import { RUTA_CRITICA_PROMPT } from "@/lib/ruta-critica-prompt";

// Las escrituras pasan por /api/followups tras la aprobación del navegador.
// Nunca exponer escrituras MCP crudas aquí.
const runtime = new CopilotRuntime({
  agents: () => ({
    default: makeAgent(randomUUID(), {
      workplace: false,
      prompt: RUTA_CRITICA_PROMPT,
    }),
  }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;
