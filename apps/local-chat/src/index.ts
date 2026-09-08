/**
 * Tier 0 — the same agent, in your terminal.
 *
 * This exists so you can iterate on the prompt, the model, and the tools with a
 * sub-second loop instead of a Slack round trip. It needs exactly one
 * credential (OPENAI_API_KEY) and starts one process.
 *
 * It is the same `makeAgent` the Channels listener uses. If it behaves here, the
 * only thing left to debug in Slack is the Slack part.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { makeAgent, DEFAULT_MODEL, isSearchConfigured } from "agent-core";

const DIM = "\x1b[2m";
const PINK = "\x1b[38;5;198m";
const OFF = "\x1b[0m";

const agent = makeAgent("local-chat");

console.log(`
${PINK}Agents, Everywhere${OFF} ${DIM}· local chat${OFF}

  model    ${process.env.MODEL ?? DEFAULT_MODEL}${process.env.OPENROUTER_API_KEY ? `  ${DIM}(via OpenRouter)${OFF}` : ""}
  search   ${isSearchConfigured() ? "Exa" : `${DIM}not configured${OFF}`}

${DIM}  This is the same agent your Channels listener runs. Ctrl-C to quit.${OFF}
`);

const rl = createInterface({ input: stdin, output: stdout });

// stdin closes on Ctrl-D, and immediately when input is piped in rather than
// typed. Without this, the next rl.question() throws ERR_USE_AFTER_CLOSE.
let closed = false;
rl.once("close", () => {
  closed = true;
});

// Tools registered on the Channel (read_thread, confirm_action, search_web) are
// not available here — they need a live thread. This surface is for exercising
// the prompt and the model.
while (!closed) {
  let text: string;
  try {
    text = (await rl.question(`${PINK}›${OFF} `)).trim();
  } catch {
    break; // stdin went away
  }
  if (!text) continue;
  if (text === "/quit" || text === "/exit") break;

  agent.addMessage({ id: randomUUID(), role: "user", content: text });

  let wrote = false;
  let failure: string | undefined;

  try {
    await agent.runAgent(
      {},
      {
        onTextMessageContentEvent({ event }) {
          wrote = true;
          stdout.write(event.delta);
        },
        onToolCallStartEvent({ event }) {
          stdout.write(`\n${DIM}  \u2192 ${event.toolCallName}${OFF}\n`);
        },
        // A provider error arrives through the run lifecycle, not as a rejection
        // from runAgent() — without this hook it surfaces as an unhandled
        // rejection with a 30-line stack.
        onRunFailed({ error }) {
          failure = error instanceof Error ? error.message : String(error);
        },
      },
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (failure) {
    console.error(`\n  ${failure.split("\n")[0]}`);
    if (/api key|401|unauthor|incorrect/i.test(failure)) {
      console.error(`  ${DIM}Check OPENAI_API_KEY in .env, then run \`npm run check-env\`.${OFF}`);
    }
    console.error("");
  } else {
    stdout.write(wrote ? "\n\n" : `${DIM}(no text response)${OFF}\n\n`);
  }
}

rl.close();
