let nextMessageSequence = 0;

/**
 * React Native gets `crypto.getRandomValues` from Expo/CopilotKit polyfills,
 * but `crypto.randomUUID` is not guaranteed. Keep message IDs independent from
 * that optional browser API so sending can never fail before the agent run.
 */
export function createUserMessageId(now = Date.now()) {
  nextMessageSequence += 1;
  return `user-${now}-${nextMessageSequence}`;
}

export function resetUserMessageIdSequenceForTests() {
  nextMessageSequence = 0;
}
