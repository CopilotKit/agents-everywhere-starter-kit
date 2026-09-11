/**
 * The runtime endpoint.
 *
 * `localhost` on a phone means the PHONE, not your laptop. Options:
 *   - iOS Simulator      → http://localhost:3100/api/mobile-copilotkit
 *   - Android emulator   → http://10.0.2.2:3100/api/mobile-copilotkit
 *   - Physical device    → http://<your-laptop-LAN-IP>:3100/api/mobile-copilotkit,
 *                          using the LAN URL printed by `npm run dev:web`, or after deploying the runtime
 *
 * Set EXPO_PUBLIC_RUNTIME_URL in apps/mobile/.env to override.
 */
export const RUNTIME_URL =
  process.env.EXPO_PUBLIC_RUNTIME_URL ??
  "http://localhost:3100/api/mobile-copilotkit";
