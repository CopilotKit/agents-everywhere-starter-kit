import { StyleSheet } from "react-native";

export const C = {
  ground: "#131019",
  surface: "#1b1724",
  border: "#2e2739",
  text: "#eeebf2",
  muted: "#948ca1",
  accent: "#ff5c9b",
};

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ground },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  eyebrow: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: { color: C.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { color: C.muted, paddingVertical: 24, fontSize: 14, lineHeight: 21 },

  bubble: { marginVertical: 5, padding: 11, borderRadius: 10, maxWidth: "88%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: C.accent },
  bubbleAgent: {
    alignSelf: "flex-start",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleTextUser: { color: "#fff", fontSize: 15, lineHeight: 21 },
  bubbleTextAgent: { color: C.text, fontSize: 15, lineHeight: 21 },

  gate: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  gateTitle: { color: C.text, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  gateBody: { color: C.muted, fontSize: 13, lineHeight: 19 },
  gateDone: { color: C.muted, fontSize: 13, fontStyle: "italic" },
  gateRow: { flexDirection: "row", gap: 8, marginTop: 12 },

  btn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnText: { color: C.text, fontSize: 14 },
  btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
  },
});
