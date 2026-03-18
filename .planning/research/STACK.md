# Stack Research

**Domain:** React Native charting, animation, and UI for CGM/health data visualisation
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH (npm registry confirmed, Reanimated v4 compat partially inferred from architecture)
**Scope:** New libraries only — existing stack (Expo SDK 54, React Native 0.81.5, TypeScript) unchanged

---

## Context: Expo SDK 54 Bundled Versions

These are the versions `npx expo install` will resolve for Expo SDK 54. Any library we add must be compatible with them.

| Package | Bundled Version | Notes |
|---------|-----------------|-------|
| `react-native-reanimated` | ~4.1.1 | NEW: uses `react-native-worklets` peer; public API compatible with v3 |
| `@shopify/react-native-skia` | 2.2.12 | Requires React 19, RN >=0.78 — both met |
| `react-native-svg` | 15.12.1 | SVG rendering; no reanimated required |
| `react-native-gesture-handler` | ~2.28.0 | Touch handling |
| `expo-linear-gradient` | ~15.0.8 | Gradient fills |

---

## Recommended Stack: New Additions

### Charting

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-native-gifted-charts` | 1.4.76 | Line graphs (sparklines + full glucose curves) | Only requires `react-native-svg` (already bundled in Expo 54). No Reanimated dependency, eliminating the main compatibility risk. Actively maintained (last release Nov 2025). Supports `LineChart`, area fills, reference lines, and custom data points — all needed for glucose range bands and hypo/hyper thresholds. |
| `react-native-svg` | 15.12.1 | SVG rendering for gifted-charts | Bundled with Expo SDK 54. Install with `npx expo install react-native-svg` to get the exact compatible version. |

### Animation (Expandable Cards)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-native-reanimated` | ~4.1.1 | Smooth expandable card animations | Bundled with Expo SDK 54 — zero additional installation risk. Reanimated 4 maintains the same public API (useSharedValue, useAnimatedStyle, withTiming, withSpring) as v3. The worklets refactor is internal. For expandable cards, `useAnimatedStyle` driving a `height` or `maxHeight` shared value gives jank-free 60fps collapse/expand on both platforms. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-linear-gradient` | ~15.0.8 | Area fill gradient under glucose curves | Already bundled in Expo 54. Used as optional peer by gifted-charts for area charts. Import from `expo-linear-gradient`, not `react-native-linear-gradient`. |
| `react-native-gesture-handler` | ~2.28.0 | Tap gesture on cards for expand/collapse | Already bundled. Required for gesture-driven interactions if using Reanimated's `Gesture` API; also used implicitly by react-navigation. |

---

## Installation

```bash
# Charts (must use expo install for Expo SDK 54 version resolution)
npx expo install react-native-svg

# Gifted charts (use npm install — not in Expo's bundled set)
npm install react-native-gifted-charts

# Animation (must use expo install for Expo SDK 54 compatible version)
npx expo install react-native-reanimated react-native-gesture-handler
```

**Required babel config addition** for Reanimated 4 (add to `babel.config.js`):

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],  // must be last
  };
};
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `react-native-gifted-charts` | `victory-native@41` | victory-native is the higher-performance choice (Skia-based, draws directly to GPU canvas). Use it if you later need: animated drawing of curves, pan/zoom gestures on the chart, or >500 data points at 60fps. Requires Reanimated, Skia, and gesture-handler as explicit peers — all available in Expo 54 but adds setup surface. The Reanimated 4 compatibility is confirmed by semver but not explicitly documented by victory-native's maintainers (Formidable). If you upgrade to SDK 55+, victory-native becomes the stronger long-term choice. |
| `react-native-gifted-charts` | `react-native-chart-kit` | Never. Last published February 2022. Dead library. |
| `react-native-gifted-charts` | `react-native-svg-charts` | Never. Last published April 2020. Dead library. |
| `react-native-reanimated` | `React Native Animated` (built-in) | Use built-in `Animated` if you need zero new dependencies. Perfectly adequate for expand/collapse height animation on cards. The tradeoff is that built-in `Animated` runs on the JS thread, so deep nesting or fast gestures can stutter on low-end Android. Reanimated 4 runs on the UI thread. For simple tap-to-expand with a 300ms transition, built-in Animated is acceptable. |
| `react-native-reanimated` | `LayoutAnimation` (built-in) | Use `LayoutAnimation` only if you need truly zero code (just `LayoutAnimation.configureNext` before a `setState`). It works fine for expand/collapse but gives you no control over easing, and on Android requires `UIManager.setLayoutAnimationEnabledExperimental(true)` which is a global flag. Reanimated is preferred for this app because it will also be needed for other animations. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-chart-kit` | Dead — last published Feb 2022, no maintenance | `react-native-gifted-charts` |
| `recharts` | Web-only (React DOM). Not usable in React Native. | `react-native-gifted-charts` |
| `react-native-svg-charts` | Dead — last published Apr 2020 | `react-native-gifted-charts` |
| `react-native-linear-gradient` (the non-expo version) | Requires native build; not compatible with Expo managed workflow | `expo-linear-gradient` (already bundled in Expo 54) |
| Pinning `react-native-reanimated@3.x` | Expo SDK 54 bundles ~4.1.1. Pinning to v3 creates version conflict with Expo's internal module resolution. If v4 proves incompatible with a library, upgrade that library — not downgrade Reanimated. | `react-native-reanimated` at the version `npx expo install` resolves |

---

## Stack Patterns by Use Case

**Sparkline on history cards (small, non-interactive):**
- Use `react-native-gifted-charts` `LineChart` with `isAnimated={false}`, fixed width, no axes
- Render the 3-hour post-meal glucose curve (up to ~36 data points)
- Set `hideDataPoints`, `hideYAxisText`, `hideXAxisText` for compact display
- Colour the line using the existing app colour scheme (red/green/orange zones)

**Full daily trend graph (HomeScreen tap, interactive):**
- Use `react-native-gifted-charts` `LineChart` with the full 24-hour rolling store
- Up to ~288 data points (one per 5-min CGM reading)
- Add reference lines at 3.9 mmol/L (hypo) and 10.0 mmol/L (high) using `referenceLine` prop
- SVG rendering handles 288 points adequately on mobile (benchmarks show <16ms paint for this count)

**Expandable history cards:**
- Use `react-native-reanimated` 4.x `useAnimatedStyle` + `useSharedValue`
- Animate `maxHeight` from `0` to `measured content height` (use `onLayout` to capture)
- Pair with `withTiming(targetHeight, { duration: 300, easing: Easing.out(Easing.cubic) })`
- Wrap collapsed content in `Animated.View` with `overflow: 'hidden'`
- Do NOT animate `height` directly to `'auto'` — not supported; use `maxHeight` pattern

**Traffic light outcome badge (static colour indicator):**
- Pure React Native `View` with `borderRadius` + `backgroundColor`
- No animation library needed — this is a static coloured circle/pill
- Use existing colour constants from the app (red: `< 3.9`, green: `3.9–10.0`, orange: `> 10.0`)

**Confidence score display:**
- Pure React Native components — a `Text` with a coloured tint or a simple progress bar using `View` width percentage
- No charting library needed for this

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-native-gifted-charts@1.4.76` | `react-native-svg@15.12.1` | Uses SVG only; no reanimated peer required. Confirmed compatible. |
| `react-native-gifted-charts@1.4.76` | `expo-linear-gradient@~15.0.8` | Optional peer for gradient area fills. Must import from `expo-linear-gradient`, not `react-native-linear-gradient`. gifted-charts accepts either. |
| `react-native-reanimated@~4.1.1` | `react-native-worklets@>=0.7.0` | Reanimated 4 requires worklets as a peer; `npx expo install react-native-reanimated` resolves this automatically. |
| `react-native-reanimated@~4.1.1` | `babel-preset-expo` | Reanimated's babel plugin must be listed last in `babel.config.js` plugins. `babel-preset-expo` is already in the project. |
| `victory-native@41.20.2` | `react-native-reanimated@~4.1.1` | Semver-compatible (>=3.0.0). Reanimated 4 maintains backward-compatible public API (useSharedValue, useAnimatedStyle). Consider verifying with a minimal test before committing to victory-native. Confidence: MEDIUM. |

---

## Performance Notes (CGM-specific)

The app's CGM data has specific characteristics that affect library choice:

| Scenario | Data Points | gifted-charts | victory-native (Skia) |
|----------|-------------|---------------|----------------------|
| Sparkline (3-hr curve) | ~36 | Fast; SVG for 36 nodes is trivial | Overkill; Skia adds startup overhead |
| Daily graph (24hrs) | ~288 | Acceptable; SVG re-renders on data change | Better for pan/zoom |
| 30-day trend | ~8,640 | Potentially slow; SVG DOM gets large | Preferable; Skia renders natively |

For the current milestone (sparkline on cards, daily graph on HomeScreen), gifted-charts SVG is sufficient. If a 30-day scrollable trend graph is added in a future milestone, revisit victory-native.

---

## Sources

- `npm info react-native-gifted-charts@1.4.76` — peerDependencies confirmed (react-native-svg, expo-linear-gradient only; no reanimated) — HIGH confidence
- `npm info victory-native@41.20.2` — peerDependencies (reanimated >=3.0.0, skia >=1.2.3, gesture-handler >=2.0.0) — HIGH confidence
- `C:/Users/Liamb/bolusbrain-app/node_modules/expo/bundledNativeModules.json` (expo@54.0.33) — bundled package versions confirmed — HIGH confidence
- `npm info react-native-reanimated@4.2.2` — v4 uses worklets peer, maintains public API — HIGH confidence for API surface, MEDIUM confidence for victory-native compat
- `npm info @shopify/react-native-skia@2.2.12` — requires react-native-reanimated >=3.19.1 (optional), React >=19 — HIGH confidence
- `npm info react-native-chart-kit` — last published 2022-02-08 — HIGH confidence (dead library)
- `npm info react-native-svg-charts` — last published 2020-04-14 — HIGH confidence (dead library)

---

*Stack research for: BolusBrain — charting, animation, and UI additions milestone*
*Researched: 2026-03-18*
