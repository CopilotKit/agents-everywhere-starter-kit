import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env.API_PROXY_TARGET ?? "http://localhost:3001";
const agent = process.env.AGENT_PROXY_TARGET ?? "http://localhost:3002";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Order matters: the first matching prefix wins, so the agent route must
    // precede the general /api route.
    proxy: {
      "/api/copilotkit": agent,
      "/api": api,
      "/portal": api,
    },
  },
});
