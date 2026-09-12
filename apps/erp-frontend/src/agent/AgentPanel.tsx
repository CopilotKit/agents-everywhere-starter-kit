import { CopilotChat, useAgentContext, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import type { RequisitionDetail } from "procure-db/types";
import { matchPath, useLocation } from "react-router";
import { fetchRequisitionDetail } from "../api/client";
import { useApi } from "../useApi";
import { GenerativeUI } from "./generativeUi";

function summarize(detail: RequisitionDetail) {
  return {
    requisitionId: detail.id,
    status: detail.status,
    waitingOn: detail.waitingOn,
    neededBy: detail.neededBy,
    lines: detail.lines.map((line) => ({
      item: line.itemName,
      sku: line.sku,
      quantity: line.quantityRequested,
      unit: line.unitOfMeasure,
    })),
    invitations: (detail.rfq?.invitations ?? []).map((invitation) => ({
      supplier: invitation.supplierName,
      status: invitation.status,
    })),
    quotesReceived: detail.quotes.length,
    purchaseOrders: detail.purchaseOrders.map((po) => po.poNumber),
  };
}

/** What the agent can see without being told: today's date and the open record. */
function PageContext() {
  const { pathname } = useLocation();
  const requisitionId = matchPath("/requisitions/:id", pathname)?.params.id;
  const open = useApi(
    () => (requisitionId ? fetchRequisitionDetail(requisitionId) : Promise.resolve(null)),
    `agent-context:${requisitionId ?? ""}`,
    { pollMs: requisitionId ? 5000 : undefined },
  );
  const now = new Date();

  useAgentContext({
    description: "Today, in the requester's local time zone",
    value: { date: now.toLocaleDateString("en-CA"), weekday: now.toLocaleDateString("en-US", { weekday: "long" }) },
  });
  useAgentContext({
    description:
      "The ERP page the requester has open. When they say 'this request' they mean openRequisition. Sending RFQs and issuing POs only happen through the propose_rfq / propose_award approval cards.",
    value: { path: pathname, openRequisition: open.data ? summarize(open.data) : null },
  });
  return null;
}

export function AgentPanel() {
  useConfigureSuggestions({
    suggestions: [
      { title: "Order pens", message: "Need 4000 ballpoint pens by Friday" },
      { title: "What's outstanding?", message: "Which requests are still waiting on suppliers?" },
      { title: "Compare quotes", message: "Compare the quotes for this request and recommend one." },
    ],
  });

  return (
    <aside className="console__agent" aria-label="Procurebot assistant">
      <div className="agent__header">
        <span className="console__brand-mark" aria-hidden="true" />
        <span>Procurebot</span>
      </div>
      <PageContext />
      <GenerativeUI />
      <CopilotChat
        className="agent__chat"
        labels={{
          welcomeMessageText: "What do you need to order?",
          chatInputPlaceholder: "e.g. Need 4000 ballpoint pens by Friday",
        }}
      />
    </aside>
  );
}
