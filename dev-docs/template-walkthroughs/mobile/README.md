# React Native template walkthrough

[Back to developer docs](../../README.md) · [Template guide](../../../templates/react-native.md)

This guide lists the captures to record from your own simulator or device. The starter ships the Expo app and offline verification, but no claimed live mobile screenshots are included.

## 1. Start the runtime and Expo

Run `npm run dev:web` from the repository root. In another terminal, run `npm ci --prefix apps/mobile`, `npm run typecheck --prefix apps/mobile`, and `npm start --prefix apps/mobile`.

Capture the Expo app after it opens and shows the seeded account balance pills.

## 2. Render app state in chat

Ask:

```text
Show my balances.
```

Expected: the agent calls `list_mobile_accounts` and renders the native accounts card. The values should match the balance pills in the header.

Ask:

```text
How am I doing on budgets?
```

Expected: the agent calls `list_mobile_budgets` and renders spent/limit rows with progress bars.

## 3. Approve a local write

Ask:

```text
Add a $9 lunch at Souvla to my Rewards Card.
```

Capture the approval card before tapping. Confirm the merchant, amount, category, and target account are the intended local sample write. Tap **Add expense** and capture the resolved result plus the changed Rewards Card balance.

## 4. Cancel a second write

Ask for another small expense and tap **Cancel**. Capture the response that says nothing changed and verify the balance did not move.

## Evidence boundary

The app changes in-memory sample finance data only. It does not connect to a bank, card issuer, budgeting provider, messaging account, or external storage. Record simulator/device, model provider, and runtime URL details in your submission notes.
