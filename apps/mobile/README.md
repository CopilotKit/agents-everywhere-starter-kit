# apps/mobile — in your pocket

An Expo app on the same agent. **Deliberately not an npm workspace member**: React
Native pins its own `react` and `react-native`, and hoisting those into the root
workspace can break `apps/web`. It installs and runs on its own.

## Status — read this first

| | |
|---|---|
| Installs, resolves, typechecks | **verified** |
| Import surface, polyfill order, headless API | **verified against 1.70.1** |
| Actually running on a simulator or device | **not verified — you do this** |

The other three surfaces in this kit were exercised end to end. This one was not,
because it needs a simulator build. Everything below is the config that *should*
be right; budget ten minutes to prove it before you build a demo on it.

## Run it

```bash
cd apps/mobile
npm install
npm start          # then press i for iOS, a for Android
```

The runtime it talks to is `apps/web` — start that first:

```bash
npm run dev --workspace web     # from the repo root, serves :3100
```

## The one thing that will bite you

`localhost` on a phone means **the phone**.

| Target | `EXPO_PUBLIC_RUNTIME_URL` |
|---|---|
| iOS Simulator | `http://localhost:3100/api/copilotkit` (the default) |
| Android emulator | `http://10.0.2.2:3100/api/copilotkit` |
| Physical device | `http://<your-laptop-LAN-IP>:3100/api/copilotkit` |

Put it in `apps/mobile/.env`.

## Why the imports look like that

- **`@copilotkit/react-native/headless`, never the root barrel.** The root entry
  imports `expo-document-picker` and `expo-file-system` unconditionally; the
  headless subpath imports none of the optional native peers. Verified by reading
  the published 1.70.1 bundles.
- **`index.js` import order is load-bearing.** `react-native-get-random-values`
  first (otherwise CopilotKit installs a `Math.random()` crypto shim and warns
  that it is not secure), then `@copilotkit/react-native/polyfills`, then the
  app. The barrel overrides `global.fetch`, and importing it before React
  Native's `InitializeCore` gets that override clobbered.
- **One polyfill import is enough on 1.70.1.** The barrel now installs streams,
  encoding, crypto, DOMException and location plus streaming fetch. Older
  versions only did streaming-fetch and needed all five granular subpaths.
- **Tool calls render through `useRenderToolCall()`.** It resolves the renderer
  *and* supplies `respond`, which is what makes the approval card answerable.
  Walking the render registry by hand is a trap — the local `useRenderTool`
  registry passes only `{ args, status }` with no `respond`, so approvals look
  fine and silently cannot be answered.

## If Metro complains

Two things this kit does not need but you might, if you start importing the root
barrel or hit a transitive Node-only dependency:

- **Stub optional native modules** in `metro.config.js` via `resolveRequest`.
- **`jose`** (a transitive JWT dependency) resolves to its Node build. Add the
  `browser` export condition for `jose` **only** — adding it to
  `unstable_conditionNames` globally breaks React Native core.
- **zod 4** uses `export * as ns from`, which needs
  `@babel/plugin-transform-export-namespace-from` on older Babel setups.
