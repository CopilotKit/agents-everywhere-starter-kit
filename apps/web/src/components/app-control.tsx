"use client";

import { useFrontendTool, useAgentContext } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { findIncident, workspaceContext, type Followup } from "@/lib/incidents";

export function AppControl({
  selectedId,
  followups,
  selectIncident,
  addFollowup,
}: {
  selectedId: string;
  followups: Followup[];
  selectIncident: (id: string) => void;
  addFollowup: (incidentId: string, title: string) => Followup;
}) {
  useAgentContext({
    description:
      "The incident workspace currently visible to the user, including sample timeline and local follow-ups. Use this context without asking the user to paste it. Never describe sample observations as live production data.",
    value: workspaceContext(selectedId, followups),
  });

  useFrontendTool(
    {
      name: "select_incident",
      description:
        "Open an existing sample incident in the workspace. Use an ID from availableIncidents.",
      parameters: z.object({ incidentId: z.string() }),
      handler: async ({ incidentId }) => {
        const incident = findIncident(incidentId);
        selectIncident(incident.id);
        return `Opened ${incident.id}: ${incident.title}. The visible details and agent context now show this incident.`;
      },
    },
    [selectIncident],
  );

  useFrontendTool(
    {
      name: "create_followup",
      description:
        "Add a follow-up task for a known incident in this browser page session only. Does not create a workplace task, send a notification, or change production. Use the selected incident unless the user specifies another.",
      parameters: z.object({
        incidentId: z.string(),
        title: z.string().trim().min(1).max(200),
      }),
      handler: async ({ incidentId, title }) => {
        const task = addFollowup(incidentId, title);
        return `Added local follow-up ${task.id} to ${task.incidentId}: ${task.title}. It is visible under that incident and will be cleared on refresh; no external system was updated.`;
      },
    },
    [addFollowup],
  );
  return null;
}
