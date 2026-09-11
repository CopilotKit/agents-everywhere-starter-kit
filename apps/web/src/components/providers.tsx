"use client";

/**
 * Client boundary for the CopilotKit provider.
 *
 * `@copilotkit/react-core/v2` uses `export *` internally, and Next refuses to
 * pull an `export *` module across a client boundary directly from a Server
 * Component. Importing it inside an explicit `"use client"` module and
 * re-exporting a named component is the fix — layout.tsx stays a Server
 * Component.
 */
import { createContext, useContext } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";

const ModelAvailable = createContext(false);
export const useModelAvailable = () => useContext(ModelAvailable);

export function Providers({
  children,
  modelAvailable,
}: {
  children: React.ReactNode;
  modelAvailable: boolean;
}) {
  // `runtimeUrl` points at the Hono handler in app/api/copilotkit.
  // If you switch that handler to `mode: "single-route"`, you must also set
  // `useSingleEndpoint` here — the two settings have to agree.
  return (
    <ModelAvailable.Provider value={modelAvailable}>
      {modelAvailable ? (
        <CopilotKitProvider runtimeUrl="/api/copilotkit">
          {children}
        </CopilotKitProvider>
      ) : (
        children
      )}
    </ModelAvailable.Provider>
  );
}
