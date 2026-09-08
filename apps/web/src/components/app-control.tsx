"use client";

/**
 * In-app actions — rung 3 on the web.
 *
 * A frontend tool lets the agent *operate the app*, not just talk about it.
 * This is the web equivalent of a Slack agent posting a Block Kit card: the
 * side effect lands in the surface the person is already looking at.
 */
import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";

export function AppControl({
  focus,
  setFocus,
}: {
  focus: string;
  setFocus: (next: string) => void;
}) {
  // Ambient context: the agent knows what the page is showing without being
  // told. This is what moves it from "reachable" to "situated".
  useAgentContext({
    description: "What the page is currently focused on",
    value: focus || "nothing yet",
  });

  useFrontendTool(
    {
      name: "set_focus",
      description:
        "Change what the page is focused on. Use it when the user asks to look at, filter to, or jump to something.",
      parameters: z.object({
        focus: z.string().describe("The surface, topic, or filter to focus the page on."),
      }),
      handler: async ({ focus: next }) => {
        setFocus(next);
        return `The page is now focused on ${next}.`;
      },
    },
    [setFocus],
  );

  return null;
}
