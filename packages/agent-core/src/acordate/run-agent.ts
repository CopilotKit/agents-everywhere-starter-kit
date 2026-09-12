import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  ToolLoopAgent,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import type { AcordateServices } from "./contracts";
import {
  runAcordateAgentInputSchema,
  type RunAcordateAgentInput,
} from "./schemas";
import { buildAcordateSystemPrompt } from "./system-prompt";
import {
  createAcordateTools,
  type AcordateToolOutcome,
} from "./tools";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export class AcordateConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcordateConfigurationError";
  }
}

export type AcordateAgentDependencies = AcordateServices & {
  model?: LanguageModel;
};

export type RunAcordateAgentResult = {
  text: string;
};

export function createGeminiModel(
  apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  modelId = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
): LanguageModel {
  if (!apiKey?.trim()) {
    throw new AcordateConfigurationError(
      "GOOGLE_GENERATIVE_AI_API_KEY is required to run Acordate with Gemini.",
    );
  }
  if (!modelId.trim()) {
    throw new AcordateConfigurationError("GEMINI_MODEL cannot be empty.");
  }

  return createGoogleGenerativeAI({ apiKey: apiKey.trim() })(modelId.trim());
}

export async function runAcordateAgent(
  input: RunAcordateAgentInput,
  dependencies: AcordateAgentDependencies,
): Promise<RunAcordateAgentResult> {
  const parsed = runAcordateAgentInputSchema.parse(input);
  const outcomes: AcordateToolOutcome[] = [];
  const tools = createAcordateTools(dependencies, parsed, (outcome) => {
    outcomes.push(outcome);
  });
  const agent = new ToolLoopAgent({
    model: dependencies.model ?? createGeminiModel(),
    instructions: buildAcordateSystemPrompt(parsed),
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(6),
  });

  const messages: ModelMessage[] = parsed.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const result = await agent.generate({ messages });
  const lastOutcome = outcomes.at(-1);

  // A model response can be wrong; the service result is authoritative. This
  // prevents a false "guardado/creado/completado" confirmation after a failed
  // persistence operation, even if the model ignores its prompt.
  if (lastOutcome && !lastOutcome.ok) {
    return {
      text: `No pude completar la operación. ${lastOutcome.error.message}`,
    };
  }

  return { text: result.text };
}
