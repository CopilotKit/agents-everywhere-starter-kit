import { Linking, Platform } from "react-native";
import Markdown, { type MarkdownStyles } from "react-native-markdown-renderer";
import { C } from "@/styles";
import { isSafeAssistantLink } from "@/assistant-links";

const monospace = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const markdownStyles: Partial<MarkdownStyles> = {
  body: { color: C.text },
  text: { color: C.text, fontSize: 15, lineHeight: 21 },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  strong: { color: C.text, fontWeight: "800" },
  em: { color: C.text, fontStyle: "italic" },
  heading1: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "800" },
  heading2: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  heading3: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  headingContainer: { marginTop: 2, marginBottom: 8 },
  heading1Container: { borderBottomWidth: 0, paddingBottom: 0 },
  heading2Container: { borderBottomWidth: 0, paddingBottom: 0 },
  list: { marginBottom: 8 },
  listUnorderedItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  listOrderedItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  listUnorderedItemIcon: {
    color: C.muted,
    marginLeft: 4,
    marginRight: 8,
    lineHeight: 21,
  },
  listUnorderedItemText: { color: C.text, fontSize: 15, lineHeight: 21 },
  listOrderedItemIcon: {
    color: C.muted,
    marginLeft: 2,
    marginRight: 8,
    lineHeight: 21,
  },
  listOrderedItemText: { color: C.text, fontSize: 15, lineHeight: 21 },
  codeInline: {
    color: C.text,
    backgroundColor: "#253037",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: monospace,
    fontSize: 13,
  },
  inlineCode: {
    color: C.text,
    backgroundColor: "#253037",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: monospace,
    fontSize: 13,
  },
  codeBlock: {
    color: C.text,
    backgroundColor: "#253037",
    borderRadius: 8,
    padding: 10,
    fontFamily: monospace,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  pre: { marginBottom: 8 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingLeft: 10,
    paddingRight: 4,
    marginBottom: 8,
  },
  link: { color: C.accent, textDecorationLine: "underline" },
  table: { borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  tableHeader: { backgroundColor: "#253037" },
  tableHeaderCell: { color: C.text, borderColor: C.border, fontWeight: "700" },
  tableRow: { borderColor: C.border },
  tableRowCell: { color: C.text, borderColor: C.border },
};

type AssistantMarkdownProps = {
  source: string;
};

export function AssistantMarkdown({ source }: AssistantMarkdownProps) {
  return (
    <Markdown
      style={markdownStyles}
      allowedImageHandlers={["https://"]}
      defaultImageHandler={null}
      onLinkPress={(url) => {
        if (!isSafeAssistantLink(url)) return;
        void Linking.openURL(url);
      }}
    >
      {source}
    </Markdown>
  );
}
