/**
 * The runtime endpoint.
 *
 * `localhost` on a phone means the PHONE, not your laptop. Options:
 *   - iOS Simulator      → http://localhost:3100 works
 *   - Android emulator   → http://10.0.2.2:3100
 *   - Physical device    → your laptop's LAN IP, e.g. http://192.168.1.20:3100
 *
 * Set EXPO_PUBLIC_RUNTIME_URL in apps/mobile/.env to override.
 */
export const RUNTIME_URL =
  process.env.EXPO_PUBLIC_RUNTIME_URL ?? "http://localhost:3100/api/copilotkit";
