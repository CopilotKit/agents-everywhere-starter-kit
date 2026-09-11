import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createUserMessageId, resetUserMessageIdSequenceForTests } from "../src/message-id.ts";

afterEach(() => {
  resetUserMessageIdSequenceForTests();
});

test("message IDs do not require crypto.randomUUID", () => {
  const originalCrypto = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto) },
      configurable: true,
    });

    assert.equal(typeof globalThis.crypto.randomUUID, "undefined");
    assert.equal(createUserMessageId(123), "user-123-1");
    assert.equal(createUserMessageId(123), "user-123-2");
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  }
});
