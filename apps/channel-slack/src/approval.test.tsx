import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToIR } from "@copilotkit/channels";
import type { ApprovalDecision } from "durable/research";
import { slackCodec } from "@copilotkit/channels/slack/codec";
import { z } from "zod";
import { approvalCard, settleApproval } from "./approval";

type Dependencies = Parameters<typeof settleApproval>[3];
const decision = { approved: true, decidedBy: "Priya" };
const render = async (deps: Dependencies, click = decision) =>
  JSON.stringify(renderToIR(await settleApproval("waitpoint_test", "run_test", click, deps)));

for (const approved of [true, false]) {
  it(`concurrent opposite clicks and replay preserve the first ${approved ? "approval" : "denial"}`, async () => {
    let saved: ApprovalDecision | undefined;
    const deps: Dependencies = {
      // Model Trigger's atomic first-write and successful no-op on later clicks.
      complete: async (_id, click) => { saved ??= click; return { success: true }; },
      retrieve: async () => ({ status: "COMPLETED", output: saved }),
    };
    const first = { approved, decidedBy: "Priya" };
    const opposite = { approved: !approved, decidedBy: "Alex" };
    const cards = await Promise.all([render(deps, first), render(deps, opposite)]);
    cards.push(await render(deps, opposite));
    for (const card of cards) {
      assert.match(card, approved ? /Approved by `Priya`/ : /Declined by `Priya`/);
      assert.doesNotMatch(card, /Alex/);
      if (approved) assert.doesNotMatch(card, /Nothing ran/);
      else assert.doesNotMatch(card, /Research will run/);
    }
    assert.equal(new Set(cards).size, 1);
  });
}

it("shows expiration when completing an expired token is a successful no-op", async () => {
  const card = await render({
    complete: async () => ({ success: true }),
    retrieve: async () => ({ status: "TIMED_OUT", error: new Error("Timed out") }),
  });
  assert.match(card, /Approval expired/);
  assert.doesNotMatch(card, /Approved by/);
});

it("does not render an accepted decision when retrieval fails", async () => {
  await assert.rejects(render({
    complete: async () => ({ success: true }),
    retrieve: async () => { throw new Error("Trigger unavailable"); },
  }), /Trigger unavailable/);
});

it("fails loudly on unconfirmed, malformed, or errored persisted outcomes", async () => {
  for (const token of [
    { status: "WAITING" as const },
    { status: "COMPLETED" as const },
    { status: "COMPLETED" as const, output: { approved: "false" } },
    { status: "COMPLETED" as const, error: new Error("Unexpected token error") },
  ]) {
    await assert.rejects(render({
      complete: async () => ({ success: true }),
      retrieve: async () => token,
    }));
  }
});

const slackCardSchema = z.object({ attachments: z.array(z.object({
  blocks: z.array(z.object({ type: z.string(), text: z.object({ text: z.string().max(3000) }).optional() })),
})).optional(), blocks: z.array(z.object({ type: z.string(), text: z.object({ text: z.string().max(3000) }).optional() })).optional() });
function cardSections(card: Parameters<typeof renderToIR>[0]) {
  const rendered = slackCardSchema.parse(slackCodec.renderEgress(renderToIR(card)));
  return [...(rendered.blocks ?? []), ...(rendered.attachments?.flatMap((attachment) => attachment.blocks) ?? [])]
    .filter((block) => block.type === "section").flatMap((block) => block.text ? [block.text.text] : []);
}
const hostileText = "<!channel> <@U123> [guide](https://evil.example) **bold** `code`";
it("approval questions stay literal through the actual Slack codec", () => {
  const sections = cardSections(approvalCard(hostileText, "run_test", async () => {}));
  assert.equal(sections[0], "`&lt;!channel&gt; &lt;@U123&gt; [guide](https://evil.example) **bold** 'code'`");
  assert.match(sections[1], /Approval sends this question to Exa/);
});
for (const approved of [true, false]) {
  it(`persisted ${approved ? "approver" : "decliner"} names stay literal through the Slack codec`, async () => {
    const card = await settleApproval("wait_test", "run_test", decision, {
      complete: async () => {},
      retrieve: async () => ({ status: "COMPLETED", output: { approved, decidedBy: hostileText } }),
    });
    const text = cardSections(card).join("\n");
    assert.match(text, /`&lt;!channel&gt; &lt;@U123&gt; \[guide\]\(https:\/\/evil.example\) \*\*bold\*\* 'code'`/);
    assert.doesNotMatch(text, /<!channel>|<@U123>|<https:/);
  });
}
it("approval renders the entire maximum-length question despite escape expansion", () => {
  const question = "<&>".repeat(665) + "FINAL";
  const sections = cardSections(approvalCard(question, "run_test", async () => {}));
  const questionText = sections.slice(0, -1).map((text) => text.slice(1, -1)).join("");
  assert.equal(questionText, question.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
});
