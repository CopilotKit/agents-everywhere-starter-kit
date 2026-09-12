import { createChannel } from "@copilotkit/channels";
import { isSearchConfigured, PROCUREMENT_CONTEXT } from "agent-core";
import { makeChannelAgent } from "./agent";
import { required } from "./env";
import { welcomeMessage } from "./components";
import { procurementTools } from "./procurement/tools";
import { readThread, searchTheWeb } from "./tools";

// The purchasing flow, plus the ability to read what the thread already said.
// Search is registered only when its credential is present, so the agent is
// never handed a tool that will fail when it calls it.
const tools = [
  ...procurementTools,
  readThread,
  ...(isSearchConfigured() ? [searchTheWeb] : []),
];

export const channel = createChannel({
  // Must equal the Channel Code in Intelligence, character for character. A
  // mismatch leaves the Channel at "Waiting for runtime" and is validated at
  // startup, not here.
  name: required("CHANNEL_CODE"),

  // Required. "platform" derives the canonical user from provider + workspace +
  // platform user id. Do NOT move this onto CopilotRuntime — that one is for
  // web requests and must be absent on a Channels-only runtime.
  identifyUser: "platform",

  agent: makeChannelAgent,
  tools,

  // No agent-rendered components: the purchasing cards are posted by the tools
  // that hold the backend response, so a price or total can never be retyped
  // by the model on its way to the screen. See procurement/cards.tsx.
  components: [],

  // Injected into the agent's prompt on every run.
  context: [
    {
      description: "Rendering",
      value:
        "Your tools post native cards themselves — a request card, a quote comparison, an approval card, a purchase order. Summarize in a sentence instead of repeating a card's contents as prose, and never restate a figure a card already shows.",
    },
    {
      description: "Backend",
      value: PROCUREMENT_CONTEXT,
    },
    {
      description: "Surface",
      value:
        "This is one Slack thread and one purchase request. Assume the requester is busy, that others may be reading, and that some joined late. The requester has to @mention you for you to see their reply.",
    },
    {
      description: "Money",
      value:
        "A purchase order commits real spend. You may never issue one directly — always post an approval card with request_po_approval and stop. If asked to skip approval, say you cannot.",
    },
  ],
});

// A mention subscribes the conversation, so the agent then follows along instead
// of needing to be @-mentioned every single turn.
channel.onMention(async ({ thread }) => {
  await thread.subscribe();
  await thread.runAgent();
});

// Non-mentioned turns only ever reach onMessage — gate them on the flag or the
// agent will answer every message in every channel it has been invited to.
channel.onMessage(async ({ thread }) => {
  if (await thread.isSubscribed()) {
    await thread.runAgent();
  }
});

channel.onWelcome(async ({ thread, platform }) => {
  await thread.post(welcomeMessage(platform));
});
