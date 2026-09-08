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
import { CopilotKitProvider } from "@copilotkit/react-core/v2";

export function Providers({ children }: { children: React.ReactNode }) {
  // `runtimeUrl` points at the Hono handler in app/api/copilotkit.
  // If you switch that handler to `mode: "single-route"`, you must also set
  // `useSingleEndpoint` here — the two settings have to agree.
  return <CopilotKitProvider runtimeUrl="/api/copilotkit">{children}</CopilotKitProvider>;
}
