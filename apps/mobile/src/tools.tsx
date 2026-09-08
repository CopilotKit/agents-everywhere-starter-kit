/**
 * The short async moment.
 *
 * The interesting mobile build is not a chat app — it is an agent that reaches
 * you, you tap once, and it carries on. `useHumanInTheLoop` is exactly that
 * shape: the agent pauses mid-run and the phone is where the decision happens.
 *
 * Same tool name and same contract as the Slack and web surfaces
 * (`confirm_action`), so the agent's behaviour does not change per device.
 */
import { Pressable, Text, View } from "react-native";
import { useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-native/headless";
import { z } from "zod";
import { styles } from "@/styles";

export function Tools() {
  useHumanInTheLoop({
    name: "confirm_action",
    description:
      "Ask the human to approve an irreversible action before taking it. Call this FIRST and only continue if it returns approval.",
    parameters: z.object({
      action: z.string().describe("What you are about to do, in one plain sentence."),
      consequence: z.string().describe("What changes in the real world if this proceeds."),
    }),
    render: ({ args, respond, result }) => {
      // `respond` is a function only while the call is executing. Narrowing on
      // it avoids importing the ToolCallStatus enum from @copilotkit/core,
      // which is only a transitive dependency here.
      if (!respond) {
        return (
          <View style={styles.gate}>
            <Text style={styles.gateDone}>{result ? String(result) : "Waiting…"}</Text>
          </View>
        );
      }
      return (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>{args.action ?? "Confirm this action"}</Text>
          {args.consequence ? <Text style={styles.gateBody}>{args.consequence}</Text> : null}
          <View style={styles.gateRow}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() =>
                void respond("Approved by the user. Proceed, then report exactly what you did.")
              }
            >
              <Text style={styles.btnPrimaryText}>Approve</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() =>
                void respond(
                  "The user declined. Do not take the action, do not offer a workaround, and say plainly that nothing was changed.",
                )
              }
            >
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      );
    },
  });

  useFrontendTool({
    name: "get_device_context",
    description:
      "Report what device the user is on and what the app can do here. Call it before claiming a capability.",
    parameters: z.object({}),
    handler: async () => ({
      surface: "mobile",
      canApproveInline: true,
      note: "Answers should be short — this is a phone screen.",
    }),
  });

  return null;
}
