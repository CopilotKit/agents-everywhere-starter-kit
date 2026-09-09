import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToIR } from "@copilotkit/channels";
import { slackCodec } from "@copilotkit/channels/slack/codec";
import { z } from "zod";
import { reportResearch } from "durable/research";

const origin = { platform: "slack", channelCode: "research", conversationKey: "original-thread" };
const payload = { tokenId: "wait_123", request: "Find sources", origin };
const renderedSchema = z.object({ blocks: z.array(z.object({
  type: z.literal("section"), text: z.object({ text: z.string().max(3000) }),
})).max(50) });

async function renderResults(findings: { title: string; url: string; highlight?: string }[]) {
  const blocks: string[] = [];
  await reportResearch("run_123", origin, {
    retrieve: async () => ({ status: "COMPLETED", payload, output: { status: "done", findings } }),
    // Exercise the same string -> IR -> Slack path as check_deep_work.
    post: async (text) => {
      const rendered = renderedSchema.parse(slackCodec.renderEgress(renderToIR(text)));
      blocks.push(...rendered.blocks.map((block) => block.text.text));
    },
  });
  return blocks;
}

test("all eight maximum-sized references survive the actual Slack codec", async () => {
  const findings = Array.from({ length: 8 }, (_, i) => ({
    title: "T".repeat(120), highlight: "H".repeat(300), url: `https://example.com/source-${i + 1}`,
  }));
  const blocks = await renderResults(findings);
  for (const hit of findings) assert.ok(blocks.some((text) => text.includes(hit.url)), `missing ${hit.url}`);
});

test("long source URLs stay complete while oversized URLs are visibly omitted", async () => {
  const usable = `https://example.com/${"a".repeat(2800)}`;
  const oversized = `https://example.com/${"b".repeat(4000)}`;
  const blocks = await renderResults([
    { title: "T".repeat(120), highlight: "H".repeat(300), url: usable },
    { title: "Oversized", url: oversized },
  ]);
  assert.ok(blocks.some((text) => text.includes(usable)));
  assert.ok(blocks.some((text) => /URL omitted.*too long/.test(text)));
  assert.ok(blocks.every((text) => !text.includes("b".repeat(100))));
});

test("untrusted source controls cannot create Slack mentions or extra links", async () => {
  const blocks = await renderResults([{
    title: "<!channel> [click](https://evil.example) `code` \u0010CODE0\u0010",
    highlight: "<@U123> & <!here>\n```\n[go](https://evil.example)",
    url: "https://example.com/path?q=a&b=c",
  }, { title: "Unsafe", url: "javascript:alert(1)" }]);
  const text = blocks.join("\n");
  assert.doesNotMatch(text, /<!channel>|<!here>|<@U123>|<https:\/\/evil.example|[\u0000-\u0008\u000b-\u001f]/);
  assert.match(text, /https:\/\/example.com\/path\?q=a&amp;b=c/);
  assert.match(text, /URL omitted.*HTTP/);
});


test("URL Markdown delimiters are encoded without changing the source target", async () => {
  const url = "https://example.com/a__b__c(1)?q=**test**~x~";
  const blocks = await renderResults([{ title: "Reference", url }]);
  const link = blocks.join("\n").match(/<(https:[^|>]+)\|Source 1>/);
  assert.ok(link, "expected a complete rendered Slack source link");
  assert.equal(decodeURIComponent(link[1]), url);
});

test("escape expansion is included in the section budget", async () => {
  const blocks = await renderResults([{
    title: "<>&".repeat(120), highlight: "<>&".repeat(300),
    url: `https://example.com/?${"&".repeat(500)}`,
  }]);
  assert.ok(blocks.some((text) => text.includes(`https://example.com/?${"&amp;".repeat(500)}`)));
});
