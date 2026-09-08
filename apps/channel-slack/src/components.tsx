/**
 * Agent-rendered components.
 *
 * `defineChannelComponent` turns a component into a tool the agent can call to
 * draw UI itself. This is rung 3 of the Context Ladder: the agent stops writing
 * paragraphs and starts rendering in the surface's own idioms — Block Kit on
 * Slack, Adaptive Cards on Teams, embeds on Discord, from one tree.
 *
 * Registered components also let their handlers be recovered after a restart
 * when a durable store is configured.
 */
import {
  defineChannelComponent,
  Message,
  Header,
  Section,
  Markdown,
  Fields,
  Field,
  Context,
  Divider,
  Actions,
  Button,
  Table,
  Row,
  Cell,
} from "@copilotkit/channels";
import { z } from "zod";

/** A decision the agent wants a human to see at a glance. */
export const BriefCard = defineChannelComponent({
  name: "brief_card",
  description:
    "Render a short brief as a native card: a headline, a one-line summary, up to four labelled facts, and an optional list of suggested next steps. Use this instead of writing a paragraph whenever the answer has structure.",
  parameters: z.object({
    headline: z.string().describe("Six words or fewer."),
    summary: z.string().describe("One sentence. What the reader needs to know."),
    facts: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .max(4)
      .default([])
      .describe("Labelled facts. Keep to four; a card is not a table."),
    nextSteps: z.array(z.string()).max(3).default([]).describe("Suggested next steps."),
    tone: z.enum(["neutral", "good", "attention"]).default("neutral"),
  }),
  render({ headline, summary, facts, nextSteps, tone }) {
    const accent = tone === "good" ? "#2E7D5B" : tone === "attention" ? "#C4145F" : "#5B6478";
    return (
      <Message accent={accent}>
        <Header>{headline}</Header>
        <Section>
          <Markdown>{summary}</Markdown>
        </Section>
        {facts.length > 0 && (
          <Fields>
            {facts.map((fact) => (
              <Field label={fact.label}>{fact.value}</Field>
            ))}
          </Fields>
        )}
        {nextSteps.length > 0 && (
          <Section>
            <Markdown>{nextSteps.map((step) => `• ${step}`).join("\n")}</Markdown>
          </Section>
        )}
      </Message>
    );
  },
});

/** Structured comparison. Slack renders a real table; thin surfaces degrade. */
export const ComparisonTable = defineChannelComponent({
  name: "comparison_table",
  description:
    "Render rows of structured data as a native table. Use for comparisons, lists of items with shared attributes, or anything you would otherwise format as an ASCII table.",
  parameters: z.object({
    title: z.string().optional(),
    columns: z.array(z.string()).min(1).max(4).describe("Column headers."),
    rows: z.array(z.array(z.string())).describe("Each row must have one cell per column."),
  }),
  render({ title, columns, rows }) {
    return (
      <Message>
        {title && <Header>{title}</Header>}
        <Table columns={columns.map((header) => ({ header }))}>
          {rows.map((row) => (
            <Row>
              {row.map((cell) => (
                <Cell>{cell}</Cell>
              ))}
            </Row>
          ))}
        </Table>
        <Divider />
        <Context>{rows.length} row(s)</Context>
      </Message>
    );
  },
});

/**
 * The welcome message. Worth shipping: a bot that says nothing when invited
 * looks broken, and a bot that lists what it can do gets used.
 */
export function welcomeMessage(platform: string) {
  return (
    <Message accent="#C4145F">
      <Header>I'm in the thread now</Header>
      <Section>
        <Markdown>
          {"Mention me and I'll answer using what's already here — the thread, who's asking, and this " +
            platform +
            " conversation. I ask before doing anything irreversible."}
        </Markdown>
      </Section>
      <Fields>
        <Field label="Try">Recap this thread</Field>
        <Field label="Try">What changed since this morning?</Field>
      </Fields>
      <Actions>
        <Button
          value="recap"
          style="primary"
          onClick={async ({ thread }) => {
            await thread.runAgent({
              prompt: "Recap this thread for someone who just joined it, then propose next steps.",
            });
          }}
        >
          Recap this thread
        </Button>
      </Actions>
    </Message>
  );
}
