/**
 * The two-tier approval, from the Slack side.
 *
 * `confirm_action` (in tools.tsx) gates cheap things: it blocks the tool with
 * `awaitChoice` and the whole thing is over in seconds.
 *
 * This is the other tier. The work is too slow to hold a chat turn open, so:
 *
 *   1. create a Trigger.dev waitpoint token
 *   2. trigger the durable task, which immediately parks on that token
 *   3. post an approval card and RETURN — the thread stays live
 *   4. a button click completes the token; the task wakes up and works
 *
 * Only registered when TRIGGER_SECRET_KEY is set, so the kit still runs without
 * a Trigger.dev account.
 */
import {
  defineChannelTool,
  Message,
  Header,
  Section,
  Markdown,
  Context,
  Actions,
  Button,
} from "@copilotkit/channels";
import type { InteractionContext, MessageRef } from "@copilotkit/channels";
import { tasks, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import type { deepWork } from "durable/trigger/deep-work";

export function isDurableConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export const runDeepWork = defineChannelTool({
  name: "run_deep_work",
  description:
    "Hand a slow, long-running job to the durable worker: anything that would take more than about thirty seconds, needs retries, or must survive a restart. It requires human approval before it starts. Use this INSTEAD of trying to do the work inside the conversation.",
  parameters: z.object({
    request: z.string().describe("What the work is, in one sentence, from the user's point of view."),
    consequence: z
      .string()
      .describe("What actually happens in the real world once this is approved."),
  }),
  async handler({ request, consequence }, { thread, user, message }) {
    // A generous timeout: the ceiling is a human's attention, not the model's.
    const token = await wait.createToken({
      timeout: "30m",
      tags: [`channel:${process.env.CHANNEL_CODE ?? "unknown"}`],
    });

    // Type-only import of the task, so the task's code is never bundled here.
    await tasks.trigger<typeof deepWork>("deep-work", {
      tokenId: token.id,
      request,
      origin: {
        platform: message?.platform ?? "unknown",
        channelCode: process.env.CHANNEL_CODE ?? "unknown",
      },
    });

    // `InteractionContext` carries `thread`, `message`, `action`, `values`,
    // `user`, `actor`, `platform` and an optional `openModal` — but NOT a
    // `messageRef`, whatever the UI reference implies. So keep the ref from
    // `thread.post()` in a binding the click handlers close over. Inline
    // handlers are in-process only anyway, so their lifetime matches this one.
    let cardRef: MessageRef | undefined;

    const settle = async (approved: boolean, ctx: InteractionContext<boolean>) => {
      // Credit the person who actually clicked, not whoever asked.
      const decidedBy = ctx.user?.name ?? ctx.actor?.id ?? "someone in this thread";
      await wait.completeToken(token.id, { approved, decidedBy });

      const outcome = approved ? (
        <Message accent="#2E7D5B">
          <Section>
            <Markdown>{`Approved by ${decidedBy}. Working on it \u2014 this keeps running even if the thread goes quiet.`}</Markdown>
          </Section>
        </Message>
      ) : (
        <Message>
          <Section>
            <Markdown>{`Declined by ${decidedBy}. Nothing ran.`}</Markdown>
          </Section>
        </Message>
      );

      if (cardRef) await ctx.thread.update(cardRef, outcome);
      else await ctx.thread.post(outcome);
    };

    cardRef = await thread.post(
      <Message accent="#C4145F">
        <Header>Waiting on you before this starts</Header>
        <Section>
          <Markdown>{`**${request}**\n\n${consequence}`}</Markdown>
        </Section>
        <Actions>
          <Button
            value={true}
            style="primary"
            onClick={async (ctx) => {
              await settle(true, ctx);
            }}
          >
            Approve
          </Button>
          <Button
            value={false}
            style="danger"
            onClick={async (ctx) => {
              await settle(false, ctx);
            }}
          >
            Cancel
          </Button>
        </Actions>
        <Context>{`waitpoint ${token.id} \u00b7 expires in 30 minutes`}</Context>
      </Message>,
    );

    // Return immediately. The agent must NOT wait here — that is the whole point.
    return "Queued the job and posted an approval card. Tell the user it is waiting on their approval and that it will keep running on its own once approved. Do not attempt the work yourself.";
  },
});
