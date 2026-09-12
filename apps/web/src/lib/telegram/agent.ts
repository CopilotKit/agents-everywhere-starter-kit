import type { AcordateAgent } from "./types";

/**
 * Temporary seam for Persona 2. It keeps Telegram testable before OpenAI and
 * the four tools are connected. Replace only this implementation at integration.
 */
export const handleAcordateMessage: AcordateAgent = async ({ message }) => ({
  text: `Recibí: “${message}”. Estoy conectando tu mensaje con Acordate.`,
});
