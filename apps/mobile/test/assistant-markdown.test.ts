import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeAssistantLink } from "../src/assistant-links.ts";

test("assistant links are limited to http and https URLs", () => {
  assert.equal(isSafeAssistantLink("https://copilotkit.ai/docs"), true);
  assert.equal(isSafeAssistantLink("http://localhost:3000"), true);
  assert.equal(isSafeAssistantLink("mailto:team@example.com"), false);
  assert.equal(isSafeAssistantLink("javascript:alert(1)"), false);
  assert.equal(isSafeAssistantLink("copilotkit://internal"), false);
  assert.equal(isSafeAssistantLink("not a url"), false);
});
