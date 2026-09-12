import { createChannel } from "@copilotkit/channels";
import { isSearchConfigured } from "agent-core";
import { makeChannelAgent } from "./agent";
import { required } from "./env";
import { welcomeMessage } from "./components";
import { procurementTools } from "./procurement/tools";
import { today } from "./procurement/backend";
import { readThread, searchTheWeb } from "./tools";

// The purchasing flow, plus the ability to read what the thread already said —
// a purchase request often starts as a conversation someone else had. Search is
// registered only when its credential is present, so the agent is never handed
// a tool that will fail when it calls it.
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
  // platform user id — which is also what becomes the requisition's requesterId.
  // Do NOT move this onto CopilotRuntime: that one is for web requests and must
  // be absent on a Channels-only runtime.
  identifyUser: "platform",

  agent: makeChannelAgent,
  tools,

  // No agent-rendered components: the purchasing cards are posted by the tools
  // that hold the backend response, so a price or total can never be retyped by
  // the model on its way to the screen. See procurement/cards.tsx.
  components: [],

  // Injected into the agent's prompt on every run.
  context: [
    {
      description: "Rendering",
      value:
        "Your tools post native cards themselves — a request card, a quote comparison, the two approval cards, a purchase order. Summarize in a sentence instead of repeating a card's contents, and never restate a figure a card already shows.",
    },
    {
      description: "Surface",
      value:
        "This is one Slack thread and one purchase request. Assume the requester is busy, that others may be reading, and that some joined late.",
    },
    {
      description: "Money",
      value:
        "Sending RFQs emails real suppliers, and a purchase order commits real spend. You may never do either directly — always post the approval card and stop. If asked to skip approval, say you cannot.",
    },
  ],
});

/**
 * Today's date, resolved per run.
 *
 * This has to be per-run context, not `createChannel({ context })`: the
 * listener is long-lived, so a date captured at startup would be wrong by
 * tomorrow — and the agent needs it to turn "by Friday" into a real date.
 */
function runContext() {
  const now = new Date();
  return [
    {
      description: "Today, in the requester's local time zone",
      value: `${today()} (${now.toLocaleDateString("en-US", { weekday: "long" })})`,
    },
  ];
}

// A mention subscribes the conversation, so the agent then follows along instead
// of needing to be @-mentioned every single turn.
channel.onMention(async ({ thread }) => {
  await thread.subscribe();
  await thread.runAgent({ context: runContext() });
});

// Non-mentioned turns only ever reach onMessage — gate them on the flag or the
// agent will answer every message in every channel it has been invited to.
channel.onMessage(async ({ thread }) => {
  if (await thread.isSubscribed()) {
    await thread.runAgent({ context: runContext() });
  }
});

channel.onWelcome(async ({ thread, platform }) => {
  await thread.post(welcomeMessage(platform));
});
