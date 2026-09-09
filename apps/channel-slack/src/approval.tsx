import { Message, Section, Markdown, Header, Actions, Button, Context } from "@copilotkit/channels";
import type { InteractionContext } from "@copilotkit/channels";
import { approvalDecisionSchema, literalExcerpt } from "durable/research";
import type { wait } from "@trigger.dev/sdk";
import type { ApprovalDecision } from "durable/research";

type RetrievedDecision = Pick<Awaited<ReturnType<typeof wait.retrieveToken>>, "status" | "output" | "error">;

/** Completion is idempotent: a successful response need not accept this click. */
export async function settleApproval(tokenId: string, runId: string, decision: ApprovalDecision, deps: {
  complete: (id: string, decision: ApprovalDecision) => Promise<unknown>;
  retrieve: (id: string) => Promise<RetrievedDecision>;
}) {
  await deps.complete(tokenId, decision);
  // Trigger persists the first accepted decision. Replays and concurrent clicks
  // must all display that same outcome, including the original decision maker.
  const token = await deps.retrieve(tokenId);
  if (token.status === "TIMED_OUT") {
    return <Message><Section><Markdown>Approval expired. Nothing ran.</Markdown></Section></Message>;
  }
  if (token.error) throw token.error;
  if (token.status !== "COMPLETED") {
    throw new Error("Trigger has not confirmed the approval decision. Check the run before retrying.");
  }
  const saved = approvalDecisionSchema.parse(token.output);
  const decidedBy = saved.decidedBy ?? "someone in this thread";
  return saved.approved ? (
    <Message accent="#2E7D5B"><Section><Markdown>{`Approved by ${literalExcerpt(decidedBy, 2000)}. Research will run in Trigger. Ask me to check ${runId} for results here.`}</Markdown></Section></Message>
  ) : (
    <Message><Section><Markdown>{`Declined by ${literalExcerpt(decidedBy, 2000)}. Nothing ran.`}</Markdown></Section></Message>
  );
}

/** Keep untrusted questions literal and complete across Slack section limits. */
export function approvalCard(request: string, runId: string, settle: (approved: boolean, ctx: InteractionContext<boolean>) => Promise<void>) {
  // At most 400 code points per section leaves room for HTML escape expansion.
  return (
    <Message accent="#C4145F">
      <Header>Approve web research</Header>
      {Array.from(request).reduce<string[]>((chunks, char, index) => {
        if (index % 400 === 0) chunks.push("");
        chunks[chunks.length - 1] += char;
        return chunks;
      }, []).map((chunk) => <Section><Markdown>{literalExcerpt(chunk, 3000)}</Markdown></Section>)}
      <Section>
        <Markdown>{"Approval sends this question to Exa and searches public web sources. It does not read logs or change external systems."}</Markdown>
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
      <Context>{`Research ${runId} · approval expires in 30 minutes. Ask me to check ${runId} to see results here; they are not pushed automatically.`}</Context>
    </Message>
  );
}
