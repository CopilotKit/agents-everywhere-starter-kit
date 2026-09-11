/**
 * A headless chat screen.
 *
 * The prebuilt `<CopilotChat>` lives on the root/components entry points and
 * brings native peers (bottom-sheet, reanimated, gesture-handler) with it. This
 * screen is deliberately hand-rolled on the headless surface so the app has no
 * native dependencies beyond Expo's own.
 *
 * The part worth copying: tool calls are rendered through `useRenderToolCall()`,
 * which resolves the right renderer AND supplies `respond` for a
 * human-in-the-loop tool. Walking the render registry by hand is a known trap —
 * the local `useRenderTool` registry passes only `{ args, status }` with no
 * `respond`, so approvals silently cannot be answered.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAgent, useRenderToolCall } from "@copilotkit/react-native/headless";
import { Tools } from "@/tools";
import { styles } from "@/styles";
import { formatMoney, initialFinance } from "@/finance";

export function ChatScreen() {
  const { agent } = useAgent({ agentId: "default" });
  const renderToolCall = useRenderToolCall();
  const [finance, setFinance] = useState(initialFinance);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setError(undefined);
    setBusy(true);

    agent.addMessage({ id: globalThis.crypto.randomUUID(), role: "user", content: text });
    try {
      await agent.runAgent(
        {},
        {
          // Provider errors arrive through the run lifecycle, not as a rejection.
          onRunFailed({ error: cause }) {
            setError(cause instanceof Error ? cause.message : String(cause));
          },
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [agent, draft, busy]);

  const messages = agent.messages ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Tools finance={finance} setFinance={setFinance} />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Template 3 · React Native</Text>
        <Text style={styles.title}>Personal finance copilot</Text>
        <View style={styles.snapshot}>
          {finance.accounts.map((account) => (
            <View key={account.id} style={styles.pill}>
              <Text style={styles.pillLabel}>{account.name}</Text>
              <Text style={styles.pillValue}>{formatMoney(account.balance, account.currency)}</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(message) => message.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Try "Show my balances", "How am I doing on budgets?", or "Add a $9
            lunch on my Rewards Card." Reads render native cards. Writes wait for
            your approval tap before changing local sample data.
          </Text>
        }
        renderItem={({ item: message }) => {
          const isUser = message.role === "user";
          const text = typeof message.content === "string" ? message.content : "";
          const toolCalls = "toolCalls" in message ? (message.toolCalls ?? []) : [];

          return (
            <View>
              {text ? (
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
                  <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAgent}>
                    {text}
                  </Text>
                </View>
              ) : null}

              {toolCalls.map((toolCall) => {
                // The matching tool result, if the run has produced one yet.
                const toolMessage = messages.find(
                  (candidate) =>
                    candidate.role === "tool" &&
                    "toolCallId" in candidate &&
                    candidate.toolCallId === toolCall.id,
                );
                return (
                  <View key={toolCall.id}>
                    {renderToolCall({ toolCall, toolMessage: toolMessage as never })}
                  </View>
                );
              })}
            </View>
          );
        }}
      />

      {error ? (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Could not reach the agent</Text>
          <Text style={styles.gateBody}>{error}</Text>
          <Text style={styles.gateBody}>Start npm run dev:web and check src/config.ts.</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your money"
            placeholderTextColor="#6e6779"
            onSubmitEditing={() => void send()}
            returnKeyType="send"
            editable={!busy}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => void send()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
