import {
  runAcordateAgent,
  type AcordateServices,
} from "agent-core/acordate";
import type { AcordateAgent } from "./types";

export function createAcordateTelegramAgent(
  services: AcordateServices,
): AcordateAgent {
  return async (turn) =>
    runAcordateAgent(
      {
        userId: turn.userId,
        messages: [{ role: "user", content: turn.text }],
        now: turn.receivedAt,
        timezone: turn.timezone,
        sourceMessageId: turn.sourceMessageId,
        activeSentReminder: turn.activeSentReminder,
      },
      services,
    );
}
