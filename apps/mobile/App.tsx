/**
 * In your pocket.
 *
 * Imports come from `@copilotkit/react-native/headless` on purpose: the ROOT
 * barrel imports `expo-document-picker` and `expo-file-system` unconditionally,
 * so pulling it in drags two native modules you may not want. The headless
 * subpath imports none of the optional native peers — verified against 1.70.1.
 */
import { CopilotKitProvider } from "@copilotkit/react-native/headless";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "@/chat";
import { RUNTIME_URL } from "@/config";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {/* Points at the same runtime the web surface uses. On a device,
          localhost is the DEVICE — see src/config.ts. */}
      <CopilotKitProvider runtimeUrl={RUNTIME_URL}>
        <ChatScreen />
      </CopilotKitProvider>
    </SafeAreaProvider>
  );
}
