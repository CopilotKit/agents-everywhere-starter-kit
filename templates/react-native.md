# Template 3: An agent in your pocket

**OpenAI or OpenRouter + CopilotKit React Native**

Build a mobile agent that reads app state, renders native cards, and waits for a tap before changing local data. The included app is a personal-finance starter with accounts, budgets, recent transactions, spending summaries, and an approved expense write. Replace the sample finance domain with the workflow your team is building.

[Mobile app README](../apps/mobile/README.md) · [iOS Simulator walkthrough](../dev-docs/template-walkthroughs/mobile/README.md)

## Start it

Complete the homepage's clone/install steps. Configure the root `.env` with either OpenAI:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
```

Or OpenRouter:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-5.6-sol
```

The React Native app uses the existing web runtime on port 3100, with a mobile-specific CopilotKit endpoint at `/api/mobile-copilotkit`.

```bash
npm run check-env
npm run dev:web
```

In another terminal:

```bash
cd apps/mobile
npm ci
npm run typecheck
npm run bundle:ios
npm run bundle:android
npm start
```

Press `i` for the iOS Simulator or `a` for Android. Set `EXPO_PUBLIC_RUNTIME_URL` in `apps/mobile/.env` when the default URL does not match your target; use the full endpoint path, for example `http://10.0.2.2:3100/api/mobile-copilotkit` for Android. Current main runs Next.js without a forced host binding; use the LAN URL printed by `npm run dev:web` for a physical device, or deploy the runtime first.

## What is included

| Piece | Implementation |
| --- | --- |
| Mobile shell | [Expo app](../apps/mobile/App.tsx) and [headless chat](../apps/mobile/src/chat.tsx) |
| App context | [Finance sample state](../apps/mobile/src/finance.ts), passed to CopilotKit from [tools](../apps/mobile/src/tools.tsx) |
| Native rendered reads | `list_mobile_accounts`, `list_mobile_budgets`, `summarize_mobile_spending`, and `list_mobile_activity` |
| Approval-gated write | `add_mobile_expense`, a CopilotKit human-in-the-loop tool that updates local state only after the tap |
| Runtime and model | [Mobile endpoint](../apps/web/src/app/api/mobile-copilotkit/[[...path]]/route.ts) using the shared model resolver |
| Prompt | [Mobile finance prompt](../packages/agent-core/src/mobile-finance-prompt.ts) |

This template uses CopilotKit React Native's headless APIs so the app stays small and Expo-friendly. The sample write changes in-memory finance state only; it does not connect to a bank, payment processor, budgeting provider, or messaging account.

## Prove the interaction

1. Start `npm run dev:web`, then start Expo from `apps/mobile`.
2. Ask: “Show my balances.” Check that the agent calls `list_mobile_accounts` and renders the native account card.
3. Ask: “How am I doing on budgets?” Check that the budget card shows spent/limit rows and progress bars.
4. Ask: “Add a $9 lunch at Souvla to my Rewards Card.” Inspect the approval card and tap **Add expense** only for the intended local demo write.
5. Confirm the card resolves with a local transaction ID and that the account balance pill changes.
6. Repeat with a second expense and tap **Cancel**. Confirm the answer says nothing changed and the balance remains the same.

Offline checks cover dependency resolution, the mobile regression suite, and TypeScript. Native smoke has also verified iOS and Android Metro exports and a clean Expo Go startup in the iOS Simulator. A live iOS Simulator run with Expo Go and OpenAI `gpt-5.6-sol` verified the balances card, formatted Markdown/link output, a $9 Souvla approval that changed Rewards Card from -$612.40 to -$621.40 only after the tap, and a $5 coffee at Blue Bottle cancellation that left the balance unchanged. This does not claim an OpenRouter live run, physical phone networking, or OCR verification. Capture your own screen recording for the hackathon submission.

## Make it yours

Change the sample data and tool contracts to match your workflow. Good mobile fits include field checklists, travel plans, patient intake preparation, fitness logs, inventory counts, and expense capture. Keep the pattern: app context first, native rendered result, explicit approval before a local or external write, and a visible result after the tap.

## Give this to your coding agent

```text
Read the root hackathon overview, rules, sponsor guide, AGENTS.md, and
templates/react-native.md. Adapt apps/mobile to our mobile workflow. Keep
CopilotKit React Native headless APIs for app context, native tool rendering,
and human-in-the-loop approval. Keep the runtime URL/device networking notes.
Replace sample finance state and tools with our own app state and one complete
approved action. Run npm ci --prefix apps/mobile, npm test --prefix apps/mobile,
npm run typecheck --prefix apps/mobile, and the relevant root checks. Record
OpenRouter, physical-phone, and OCR evidence separately if your submission
depends on those paths.
```

## Upstream source

This template is inspired by CopilotKit PR [#5430](https://github.com/CopilotKit/CopilotKit/pull/5430), `examples/showcases/react-native-personal-finance` at commit `6815a3eed0d80570cc17c121d952b94d5543d0a7`. The starter kit adapts the idea into the existing Expo app and shared runtime instead of copying the standalone bare React Native app, Next runtime, screenshots, video, native iOS/Android projects, or Git LFS media.
