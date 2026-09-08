"use client";

/**
 * Generative UI, controlled tier.
 *
 * `useComponent` gives the agent a catalog of *your* React components and lets
 * it choose one and fill in the props. The interface stays on-brand and
 * pixel-perfect because you wrote it — the agent only decides what to show.
 *
 * These are deliberately the same two components the Slack surface registers
 * with `defineChannelComponent`. Same agent, same intent, native rendering on
 * each surface — which is the whole claim this kit is making.
 *
 * The render function receives the schema output directly as props.
 */
import { useComponent, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { z } from "zod";

const toneColor = { neutral: "var(--muted)", good: "#2e7d5b", attention: "var(--accent)" } as const;

export function GenerativeUI() {
  useComponent({
    name: "brief_card",
    description:
      "Render a short brief as a card: a headline, a one-line summary, up to four labelled facts, and optional next steps. Use this instead of a paragraph whenever the answer has structure.",
    parameters: z.object({
      headline: z.string().describe("Six words or fewer."),
      summary: z.string().describe("One sentence."),
      facts: z.array(z.object({ label: z.string(), value: z.string() })).max(4).default([]),
      nextSteps: z.array(z.string()).max(3).default([]),
      tone: z.enum(["neutral", "good", "attention"]).default("neutral"),
    }),
    render: ({ headline, summary, facts, nextSteps, tone }) => (
      <article className="ck-card" style={{ borderLeftColor: toneColor[tone] }}>
        <h3>{headline}</h3>
        <p>{summary}</p>
        {facts.length > 0 && (
          <dl className="ck-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {nextSteps.length > 0 && (
          <ul className="ck-steps">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        )}
      </article>
    ),
  });

  useComponent({
    name: "comparison_table",
    description:
      "Render rows of structured data as a table. Use for comparisons or lists of items sharing attributes.",
    parameters: z.object({
      title: z.string().optional(),
      columns: z.array(z.string()).min(1).max(4),
      rows: z.array(z.array(z.string())),
    }),
    render: ({ title, columns, rows }) => (
      <article className="ck-card">
        {title && <h3>{title}</h3>}
        <div className="ck-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    ),
  });

  /**
   * The approval gate, web idiom.
   *
   * Same contract as `confirm_action` in the Slack surface: the agent must ask
   * before anything irreversible, and cannot proceed past a refusal.
   *
   * `respond` is a function ONLY while the tool call is executing — narrowing on
   * its presence is safer than importing the ToolCallStatus enum from
   * @copilotkit/core, which is only a transitive dependency here.
   */
  useHumanInTheLoop({
    name: "confirm_action",
    description:
      "Ask the human to approve an irreversible action before taking it. Call this FIRST and only continue if it returns approval.",
    parameters: z.object({
      action: z.string().describe("What you are about to do, in one plain sentence."),
      consequence: z.string().describe("What changes in the real world if this proceeds."),
    }),
    render: ({ args, respond, result }) => {
      if (!respond) {
        return (
          <article className="ck-card ck-card--gate">
            <p className="ck-gate-done">{result ? String(result) : "Waiting…"}</p>
          </article>
        );
      }
      return (
        <article className="ck-card ck-card--gate">
          <h3>{args.action ?? "Confirm this action"}</h3>
          <p>{args.consequence}</p>
          <div className="ck-actions">
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              onClick={() =>
                respond("Approved by the user. Proceed, then report exactly what you did.")
              }
            >
              Approve
            </button>
            <button
              type="button"
              className="ck-btn"
              onClick={() =>
                respond(
                  "The user declined. Do not take the action, do not offer a workaround, and say plainly that nothing was changed.",
                )
              }
            >
              Cancel
            </button>
          </div>
        </article>
      );
    },
  });

  // Hooks register into the chat stream, so this component renders nothing.
  return null;
}
