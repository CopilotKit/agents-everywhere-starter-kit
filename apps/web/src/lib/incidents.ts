/** Sample incident context. Follow-ups are retrieved separately from Ambiguous. */
import type { WorkplaceTask } from "./followup-types";

export const incidents = [
  {
    id: "INC-1042",
    title: "Checkout latency after deploy",
    severity: "SEV 2",
    status: "Investigating",
    service: "Checkout API",
    owner: "Maya Chen",
    channel: "#inc-checkout",
    updated: "09:24 UTC",
    summary:
      "Customers are waiting longer to complete checkout. Latency rose after the latest deployment; no confirmed root cause yet.",
    impact:
      "P95 latency is 4.8s, up from 420ms. Approximately 18% of checkout requests are affected.",
    timeline: [
      {
        time: "09:12",
        author: "Deploy bot",
        detail: "Checkout v2.18 deployed to production.",
      },
      {
        time: "09:17",
        author: "Monitor",
        detail: "P95 latency crossed the 2s alert threshold.",
      },
      {
        time: "09:24",
        author: "Maya Chen",
        detail:
          "Investigating connection pool saturation. Rollback is an option, not yet approved.",
      },
    ],
  },
  {
    id: "INC-1043",
    title: "Delayed notification delivery",
    severity: "SEV 3",
    status: "Monitoring",
    service: "Notifications",
    owner: "Alex Rivera",
    channel: "#inc-notifications",
    updated: "09:31 UTC",
    summary:
      "Email notifications are arriving late. Additional workers are draining the queue and delivery times are improving.",
    impact:
      "A backlog of 2,400 messages remains. No messages have been lost in this sample scenario.",
    timeline: [
      {
        time: "09:05",
        author: "Support",
        detail: "Customers report delayed confirmation emails.",
      },
      {
        time: "09:19",
        author: "Alex Rivera",
        detail: "Added two queue workers after identifying a traffic spike.",
      },
      {
        time: "09:31",
        author: "Monitor",
        detail: "Oldest message age fell from 14 minutes to 3 minutes.",
      },
    ],
  },
] as const;

export type Incident = (typeof incidents)[number];

export function findIncident(id: string): Incident {
  const incident = incidents.find((item) => item.id === id);
  if (!incident)
    throw new Error(
      `Unknown incident ${id}. Choose ${incidents.map((item) => item.id).join(" or ")}.`,
    );
  return incident;
}

export function workspaceContext(
  selectedId: string,
  followups: WorkplaceTask[],
) {
  return {
    dataSource:
      "Fictional sample incidents. Follow-ups shown here were retrieved from Ambiguous for the selected incident. A proposal is not a saved task.",
    availableIncidents: incidents.map(({ id, title, status }) => ({
      id,
      title,
      status,
    })),
    selectedIncident: {
      ...findIncident(selectedId),
      timeline: [...findIncident(selectedId).timeline],
    },
    followups,
  };
}
