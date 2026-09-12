import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { DataVersionProvider } from "./useApi";
import "./index.css";
import "./agent/agent.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    {/* Set enableInspector to true to debug agent events; it overlaps the chat panel otherwise. */}
    <CopilotKitProvider runtimeUrl="/api/copilotkit" enableInspector={false}>
      <BrowserRouter>
        <DataVersionProvider>
          <App />
        </DataVersionProvider>
      </BrowserRouter>
    </CopilotKitProvider>
  </StrictMode>,
);
