/**
 * Entry point. ORDER MATTERS HERE.
 *
 * 1. `react-native-get-random-values` first — CopilotKit's own crypto polyfill
 *    falls back to Math.random() and warns that it is not cryptographically
 *    secure. Installing a real one first means that branch never runs.
 *
 * 2. Then the CopilotKit polyfill barrel. In 1.70.1 this single import installs
 *    all of them — streams, encoding, crypto, DOMException, location — plus
 *    streaming fetch. (In older versions the barrel only did streaming-fetch and
 *    you had to import the five granular subpaths yourself. Not any more.)
 *
 * 3. Only then the app. The barrel overrides global.fetch, so importing it
 *    before React Native's InitializeCore has run gets that override clobbered.
 */
import "react-native-get-random-values";
import "@copilotkit/react-native/polyfills";

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
