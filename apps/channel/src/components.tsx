/**
 * Agent-rendered components for the on-call agent.
 *
 * `defineChannelComponent` turns a component into a tool the agent can call to
 * draw UI itself. During an incident, a native card is easier to scan than a
 * paragraph, but everyone reads a card.
 *
 * One tree renders as Slack Block Kit, Teams Adaptive Cards, and Discord
 * components. A surface that cannot render a node skips it rather than failing.
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

/** Severity drives the colour rail, so the channel can triage by glance. */
const SEVERITY = {
  sev1: { accent: "#C4145F", label: "SEV1 · customer-facing" },
  sev2: { accent: "#8A5C10", label: "SEV2 · degraded" },
  sev3: { accent: "#5B6478", label: "SEV3 · internal" },
  resolved: { accent: "#2E7D5B", label: "RESOLVED" },
} as const;

/**
 * The state of the incident, as one glanceable card.
 *
 * Deliberately has no "what happened" prose field. The thread is the narrative;
 * this is the summary a person joining at minute 40 needs.
 */
export const IncidentCard = defineChannelComponent({
  name: "incident_card",
  description:
    "Draw the current state of the incident as a card: severity, what is affected, what is known, and what is being tried. Call this once you have read the thread, and call it again when the picture changes. Prefer it over describing the incident in prose.",
  parameters: z.object({
    severity: z.enum(["sev1", "sev2", "sev3", "resolved"]),
    headline: z.string().describe("What is broken, in under ten words."),
    impact: z.string().describe("Who or what is affected, concretely."),
    started: z.string().describe("When it started, as stated in the thread. 'unknown' is a valid answer."),
    known: z.array(z.string()).max(4).default([]).describe("What the thread has established."),
    trying: z.array(z.string()).max(3).default([]).describe("What is currently being attempted."),
    owner: z.string().optional().describe("Who is driving, if the thread says."),
  }),
  render({ severity, headline, impact, started, known, trying, owner }) {
    const sev = SEVERITY[severity];
    return (
      <Message accent={sev.accent}>
        <Header>{headline}</Header>
        <Context>{sev.label}</Context>
        <Fields>
          <Field label="Impact">{impact}</Field>
          <Field label="Started">{started}</Field>
          {owner && <Field label="Driving">{owner}</Field>}
        </Fields>
        {known.length > 0 && (
          <Section>
            <Markdown>{`*What we know*\n${known.map((k) => `• ${k}`).join("\n")}`}</Markdown>
          </Section>
        )}
        {trying.length > 0 && (
          <Section>
            <Markdown>{`*Being tried*\n${trying.map((t) => `• ${t}`).join("\n")}`}</Markdown>
          </Section>
        )}
      </Message>
    );
  },
});

/**
 * The incident timeline. Handover and the postmortem both run on this, which is
 * why it is worth keeping in the thread rather than someone's notes app.
 */
export const Timeline = defineChannelComponent({
  name: "timeline",
  description:
    "Draw an ordered timeline of what happened when. Call this when there are three or more events worth ordering — it is what on-call handover and the postmortem are written from.",
  parameters: z.object({
    title: z.string().default("Timeline"),
    events: z
      .array(
        z.object({
          at: z.string().describe("Time as the thread states it, e.g. '02:14' or '~20m ago'."),
          what: z.string().describe("What happened, in one line."),
          who: z.string().optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
  render({ title, events }) {
    return (
      <Message>
        <Header>{title}</Header>
        <Table
          columns={[{ header: "When" }, { header: "What" }, { header: "Who" }]}
        >
          {events.map((event) => (
            <Row>
              <Cell>{event.at}</Cell>
              <Cell>{event.what}</Cell>
              <Cell>{event.who ?? "—"}</Cell>
            </Row>
          ))}
        </Table>
        <Divider />
        <Context>{`${events.length} event(s) · newest last`}</Context>
      </Message>
    );
  },
});

/**
 * The welcome message. A bot that says nothing when invited looks broken; one
 * that says what it will do on its own gets used.
 */
export function welcomeMessage(platform: string) {
  return (
    <Message accent="#4A6FA5">
      <Header>Purchasing assistant, in the thread</Header>
      <Section>
        <Markdown>
          {"@-mention me with what you need to buy and I will take it from there — " +
            "matching it to the catalog, sending it out for quotes, and comparing what comes back. " +
            "One " +
            platform +
            " thread is one purchase request."}
        </Markdown>
      </Section>
      <Fields>
        <Field label="I will">Match items, chase quotes, compare suppliers</Field>
        <Field label="I won't">Raise a purchase order without your approval</Field>
      </Fields>
      <Actions>
        <Button
          value="catalog"
          style="primary"
          onClick={async ({ thread }) => {
            await thread.runAgent({
              prompt: "Show me what is in the catalog.",
            });
          }}
        >
          Show the catalog
        </Button>
      </Actions>
    </Message>
  );
}
