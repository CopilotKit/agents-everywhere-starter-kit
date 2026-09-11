# apps/mobile — React Native template

An Expo app for Template 3: a mobile finance copilot that reads app state, renders native cards in chat, and waits for a tap before changing local sample data.

The app is deliberately not an npm workspace member. React Native pins its own `react`, `react-native`, and Expo versions, and hoisting those into the root workspace can break the web app.

## Status

| Check | Status |
| --- | --- |
| Dependency install | verified with `npm ci --prefix apps/mobile` |
| Offline tests | verified with `npm test --prefix apps/mobile` (11 tests) |
| TypeScript | verified with `npm run typecheck --prefix apps/mobile` |
| Metro exports | verified for iOS and Android with `npm run bundle:ios --prefix apps/mobile` and `npm run bundle:android --prefix apps/mobile` |
| iOS Expo Go smoke | verified clean first render and mobile runtime metadata `/info` HTTP 200 with a placeholder process key |
| Live model chat | not claimed in this PR |
| Approval UI end-to-end | not claimed in this PR |
| Physical phone / OCR verification | not claimed in this PR |

## Run it

Start the runtime first from the repository root:

```bash
npm run dev:web
```

The runtime uses the root model configuration. OpenAI and OpenRouter both work through the shared model resolver:

```dotenv
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key
MODEL=gpt-5.6-sol
```

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
MODEL=openai/gpt-5.6-sol
```

Then run the mobile app:

```bash
cd apps/mobile
npm ci
npm run typecheck
npm run bundle:ios
npm run bundle:android
npm start
```

Press `i` for the iOS Simulator or `a` for Android. For a physical device, first make the web runtime reachable from the device, then scan the Expo code.

## Runtime URL

The default endpoint is `http://localhost:3100/api/mobile-copilotkit`, served by `apps/web`. On a real phone, `localhost` means the phone, not your laptop.

| Target | `EXPO_PUBLIC_RUNTIME_URL` |
| --- | --- |
| iOS Simulator | `http://localhost:3100/api/mobile-copilotkit` |
| Android emulator | `http://10.0.2.2:3100/api/mobile-copilotkit` |
| Physical device | `http://<your-laptop-LAN-IP>:3100/api/mobile-copilotkit` using the LAN URL printed by `npm run dev:web`, or after deploying the runtime |

Put the override in `apps/mobile/.env`. Current main runs Next.js without a forced host binding. For a physical device, use the LAN URL printed by `npm run dev:web`, or deploy the runtime first.

## What to try

Ask:

```text
Show my balances.
```

Expected: `list_mobile_accounts` renders a native account card.

Ask:

```text
How am I doing on budgets?
```

Expected: `list_mobile_budgets` renders spent/limit rows.

Ask:

```text
Add a $9 lunch at Souvla to my Rewards Card.
```

Expected: `add_mobile_expense` renders an approval card. Tapping **Add expense** updates the local in-memory account balance and returns a local transaction ID. Tapping **Cancel** changes nothing.

## How it is wired

| Piece | File |
| --- | --- |
| App shell | [App.tsx](App.tsx) |
| Headless chat | [src/chat.tsx](src/chat.tsx) |
| Finance sample state | [src/finance.ts](src/finance.ts) |
| CopilotKit tools and app context | [src/tools.tsx](src/tools.tsx) |
| Runtime URL | [src/config.ts](src/config.ts) |
| Mobile runtime endpoint | [../web/src/app/api/mobile-copilotkit/[[...path]]/route.ts](../web/src/app/api/mobile-copilotkit/[[...path]]/route.ts) |
| Mobile prompt | [../../packages/agent-core/src/mobile-finance-prompt.ts](../../packages/agent-core/src/mobile-finance-prompt.ts) |

Imports come from `@copilotkit/react-native/headless` so the template avoids optional native peers from the prebuilt chat UI. `index.js` imports `react-native-get-random-values` before CopilotKit polyfills, then registers the Expo app.

`metro.config.js` routes the transitive `jose` dependency through its browser export for native bundles. This is intentionally narrow: it does not stub Node built-ins or mask missing native functionality.

## Limits

This template changes local sample state only. It does not connect to bank accounts, cards, payment services, external storage, messaging providers, or the OpenAI Realtime voice route. Use it as the phone-native approval and app-context pattern, then replace the sample finance data and tools with your hackathon workflow.

## Upstream source

Inspired by CopilotKit PR [#5430](https://github.com/CopilotKit/CopilotKit/pull/5430), `examples/showcases/react-native-personal-finance` at commit `6815a3eed0d80570cc17c121d952b94d5543d0a7`. This app adapts the concept into the starter kit's existing Expo app and shared web runtime. It does not copy the standalone bare native project, screenshots, video, Git LFS media, or credentials.
