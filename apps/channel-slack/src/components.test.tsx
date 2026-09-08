/**
 * Component tests.
 *
 * `renderToIR` lowers a Channels JSX tree to the platform-neutral IR the
 * adapter is actually handed — `{ type, props }` nodes — so these run with no
 * Slack app, no Intelligence project and no credentials of any kind.
 *
 * That matters for a hackathon kit: change a card, know in a second whether you
 * broke it. Node's built-in runner means there is nothing to install either.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToIR } from "@copilotkit/channels";
import { IncidentCard, Timeline } from "./components";

const ctx = { platform: "slack" as const, signal: new AbortController().signal };

/** The rendered IR as a searchable string. */
async function render(node: unknown): Promise<string> {
  return JSON.stringify(renderToIR((await node) as never));
}

const baseIncident = {
  severity: "sev2" as const,
  headline: "Checkout latency above 4s",
  impact: "~12% of checkouts, EU region",
  started: "02:14 UTC",
  known: [] as string[],
  trying: [] as string[],
};

describe("incident_card", () => {
  it("colours the rail by severity, so the channel can triage by glance", async () => {
    const sev1 = await render(IncidentCard.render({ ...baseIncident, severity: "sev1" }, ctx));
    const resolved = await render(IncidentCard.render({ ...baseIncident, severity: "resolved" }, ctx));

    assert.ok(sev1.includes("#C4145F"), "sev1 should use the attention accent");
    assert.ok(resolved.includes("#2E7D5B"), "resolved should use the good accent");
    assert.notEqual(sev1, resolved);
  });

  it("labels the severity in words, not just colour", async () => {
    // Colour alone fails anyone colour-blind and every screen reader.
    const out = await render(IncidentCard.render({ ...baseIncident, severity: "sev1" }, ctx));
    assert.ok(out.includes("SEV1"));
    assert.ok(out.includes("customer-facing"));
  });

  it("omits the owner field entirely when the thread has not said who is driving", async () => {
    const without = await render(IncidentCard.render(baseIncident, ctx));
    const with_ = await render(IncidentCard.render({ ...baseIncident, owner: "priya" }, ctx));

    assert.ok(!without.includes("Driving"), "no owner should mean no Driving field");
    assert.ok(with_.includes("Driving"));
    assert.ok(with_.includes("priya"));
  });

  it("omits the known/trying sections when empty rather than drawing empty headings", async () => {
    const empty = await render(IncidentCard.render(baseIncident, ctx));
    assert.ok(!empty.includes("What we know"));
    assert.ok(!empty.includes("Being tried"));

    const filled = await render(
      IncidentCard.render(
        { ...baseIncident, known: ["Rollback did not help"], trying: ["Draining the queue"] },
        ctx,
      ),
    );
    assert.ok(filled.includes("What we know"));
    assert.ok(filled.includes("Rollback did not help"));
    assert.ok(filled.includes("Being tried"));
  });

  it("always carries impact and start time — the two things a late joiner needs", async () => {
    const out = await render(IncidentCard.render(baseIncident, ctx));
    assert.ok(out.includes("~12% of checkouts, EU region"));
    assert.ok(out.includes("02:14 UTC"));
  });
});

describe("timeline", () => {
  it("renders every event and counts them in the footer", async () => {
    const events = [
      { at: "02:14", what: "Alerts fired", who: "pagerduty" },
      { at: "02:19", what: "Rolled back web", who: "priya" },
      { at: "02:31", what: "Latency still high" },
    ];
    const out = await render(Timeline.render({ title: "Timeline", events }, ctx));

    for (const event of events) assert.ok(out.includes(event.what), `missing "${event.what}"`);
    assert.ok(out.includes("3 event(s)"));
  });

  it("fills the who column with a dash rather than leaving a hole", async () => {
    const out = await render(
      Timeline.render({ title: "T", events: [{ at: "02:31", what: "no owner" }] }, ctx),
    );
    assert.ok(out.includes("—"));
  });
});
