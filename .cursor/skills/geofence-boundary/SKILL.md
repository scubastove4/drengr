---
name: geofence-boundary
description: Rules for implementing the player boundary (geofence) in this Expo / React Native game using Turf.js and the native Mapbox map. Use whenever the task touches geofencing, play-area boundaries, out-of-bounds or violation logic, near-edge warnings, GPS tolerance buffers, point-in-polygon checks, drawing the boundary on the map, or checking useGameLocation output against an area. Apply it even if the user doesn't say "geofence", for example "what happens when a player leaves the area" or "flag players near the edge". Prevents guessing Turf APIs, swapping lng/lat, importing the wrong Turf package, using web-only Mapbox GL JS APIs in React Native, starting a second GPS watcher, and flagging violations without the required grace period.
---

# Geofence boundary

Players are confined to a defined play area. Leaving it **flags** the player as in violation. It does not block movement (a phone can't be stopped from moving) and it must not trigger instantly.

Project-wide rules (Expo CLI, dev builds, Mapbox token handling, generated native folders, phases and design principles) live in `.cursor/rules/project-overview.mdc`. Follow them. This skill only covers the geofence.

## Non-negotiable requirements

1. **Grace period.** Require 2-3 s of *sustained* out-of-bounds before a violation is raised, to avoid flicker at the edge. Default `OUT_OF_BOUNDS_GRACE_MS = 2500`, held in one named config constant, never inlined.
2. **Sustained means uninterrupted.** Any in-bounds fix resets the pending state.
3. **Flag, don't block.** A violation is an event/state the game reacts to. Do not clamp, snap, or teleport the player's position unless the user explicitly asks.
4. **Edge-triggered.** Emit `violation-started` once when the grace period elapses and `violation-cleared` once on return. Never emit per fix.
5. **Time-based check.** The grace period is also enforced by the clock, not only by incoming fixes, so a player who steps out and stands still is still flagged (see below).

If a task conflicts with any of these, stop and ask rather than choosing silently.

## Location input: one watcher only

`useGameLocation` starts its own `watchPositionAsync` subscription on every call, and `App.tsx` already calls it. **Never call `useGameLocation` from a new hook or component.** Take its `fix` (type `GameLocationFix`) as an argument instead, e.g. `useGeofence(fix)`, with `App.tsx` as the only caller.

Consume `fix`, not `turfPoint`: the state machine needs `timestamp` and `accuracyM`, which `turfPoint` doesn't carry, and `booleanPointInPolygon` accepts a plain `[lng, lat]` array.

Convert once, where the fix enters the geofence code. New geofence code uses `lng`/`lat`; existing hook code keeps `latitude`/`longitude`:

| Geofence `Fix` | `GameLocationFix` |
|---|---|
| `lng` | `longitude` |
| `lat` | `latitude` |
| `accuracyM` (`number \| null`) | `accuracyM` |
| `timestampMs` | `timestamp` (ms since epoch) |

## Sampling, accuracy and the time-based check

- **Platform scope: iOS only for now.** Android is out of scope. Don't add Android-specific handling or workarounds unprompted. If Android is added later, revisit this section (see "Android, if added later").
- **iOS updates are distance-only.** In `expo-location`, `timeInterval` is Android-only; the hook's 4 s setting has no effect on iOS, where updates arrive only after `distanceInterval` (5 m) of movement. A stationary player produces no fixes.
- **So violations are also raised by the clock.** While the state is `pending`, a timer fires at `outSinceMs + OUT_OF_BOUNDS_GRACE_MS` and calls `tick`, which treats the last known position as still current. If no in-bounds fix has arrived by then, the violation is raised even if no new fix came. This closes the "step out and stand still" exploit. Losing signal while `pending` counts as still out.
- **Known tradeoff (ask before changing).** Because of `tick`, a single out-of-bounds reading raises a violation once the grace period passes unless an in-bounds fix arrives first. On iOS a corrective fix is only delivered after about 5 m of reported movement, so a stationary player near the edge can stay flagged after one jittery reading. Do not resolve this silently. Options to raise with the user: confirm with a fresh one-shot reading when the timer fires (verify the `expo-location` API and options first, and note this goes beyond "one watcher only"); count a fix as out only if it is outside by more than its reported accuracy; or accept it and rely on the buffer zone.
- **Foreground only.** JS timers aren't reliable when the app is backgrounded. Backgrounding is outside this skill's scope; don't claim coverage for it.
- **Accuracy:** the hook requests `Accuracy.Balanced` (about 100 m on iOS) to limit battery use. Higher accuracy (`Accuracy.High`) is preferred if battery allows and may be revisited. At the current setting, positions near the edge are inherently fuzzy; the buffer zone exists for that.
- **`MAX_ACCURACY_M` is `null` (no accuracy filtering)** until real accuracy values have been measured on a physical device. Do not invent a number.

Do **not** change `timeInterval`, `distanceInterval` or `Accuracy`, or set `MAX_ACCURACY_M`, without the user's approval.

### Android, if added later

The single-reading tradeoff above applies on Android too, and is likely more frequent there: Android honors `timeInterval` (4 s in the hook), which is longer than the grace period, so an isolated out-of-bounds fix can raise a violation before the next fix corrects it. Decide with the user how to handle that before shipping Android; don't pick silently.

## Coordinates

- GeoJSON, Turf and Mapbox use **`[longitude, latitude]`**.
- Boundary data is a GeoJSON `Feature<Polygon | MultiPolygon>` with one typed source of truth (e.g. `BOUNDARY`). Do not redefine or inline polygons elsewhere. GeoJSON rings must be closed (first and last position equal).

## Turf.js (`@turf/turf` 7.3.5)

- **Import named functions from `@turf/turf` only**, matching `useGameLocation` (`import { point } from "@turf/turf"`).
- **Never import `@turf/helpers` or individual `@turf/*` packages directly.** The top-level `@turf/helpers` is v6.5.0 (pulled in by `@rnmapbox/maps`), and per-function packages such as `@turf/boolean-point-in-polygon` aren't declared dependencies, so they only resolve by accident of npm's layout.
- Containment uses `booleanPointInPolygon` (exported from `@turf/turf`). **Never hand-roll point-in-polygon math.** It takes a point Feature, a Point, or `[lng, lat]`, and a `Feature<Polygon | MultiPolygon>` or bare geometry. A point exactly on the edge counts as inside; `ignoreBoundary` defaults to `false`. Change that only if the user asks.
- Do not guess other Turf APIs. Confirm the signature, units and sign conventions in the typings under `node_modules/@turf/turf` before using them.
- Run containment in-process on the device. No network call for this check.

## Architecture: keep the logic pure

1. **`isInsideBoundary(coord, boundary): boolean`**: thin `booleanPointInPolygon` wrapper. No state, no time.
2. **`step(state, fix, isInside, config)` and `tick(state, nowMs, config)`**: pure state machine, both returning `{ state, event }`. Time comes only from arguments (`fix.timestampMs`, `nowMs`), both epoch milliseconds. No `Date.now()`, no timers, no React, Expo or Mapbox imports (so it can later run on a server if enforcement needs to be authoritative).
3. **Glue hook (`useGeofence(fix)`)**: calls 1 then 2, emits events to the game, and owns the clock.
   - **Placement:** call it in `App.tsx` directly below `useGameLocation`, **before** any early `return` (hooks can't be called conditionally).
   - **Input:** accept `fix: GameLocationFix | null`. A `null` fix is a no-op. Initial state is `{ status: 'inside' }`: nothing is flagged until a fix provides evidence.
   - **State and events:** keep the machine state in a `useRef`. Run `step` in an effect on `fix`, and `tick` in the timer callback. Emit events by calling the game's callback from those handlers, **never from inside a reducer or during render** (React may run reducers twice, which would duplicate events). Mirror `status` into `useState` only if the UI needs to render it. Handling the same fix twice must be harmless.
   - **Timer:** when the state enters `pending`, schedule a timeout for the time remaining until the grace period elapses; clear it when the state leaves `pending` and on unmount. Calculate the delay as `outSinceMs + OUT_OF_BOUNDS_GRACE_MS - Date.now()` and **clamp it to 0 or more**. If `tick` runs and the state is still `pending` (the timer fired before the grace period fully elapsed), schedule a new timeout for the remaining time. `Date.now()` and `setTimeout` live here only.
   - **Stale GPS vs grace (required):** on iOS a stationary player’s last fix can be seconds/minutes old. If `outSinceMs` stays as that fix’s `timestampMs`, the timer delay clamps to 0 and violation fires immediately. When `step` first transitions into `pending`, the glue must set `outSinceMs` to **`Date.now()`** (wall clock) before scheduling the timer, so grace is ~2.5 s of real time. Pure `step` may still stamp `fix.timestampMs`; overwrite only on the enter-pending transition. Do not rewrite `outSinceMs` on later outside fixes while already `pending`.
   - **Permission loss:** `useGameLocation` keeps the last `fix` if permission is revoked mid-match. If status is `pending` or `violating` when foreground permission drops below granted, clear the timer and call `forceViolation` so a pending player becomes `violating` immediately (one `violation-started` if not already violating). Do not reset to `inside` — that would let players toggle location to dodge a reveal. Re-check permission when the app becomes active; otherwise Settings revoke never flips `permissionGranted`.

Reference shape (adapt names, keep semantics):

```ts
export type Fix = {
  lng: number;
  lat: number;
  accuracyM: number | null; // expo-location accuracy can be null
  timestampMs: number;
};

export type GeofenceState =
  | { status: 'inside' }
  | { status: 'pending'; outSinceMs: number }
  | { status: 'violating'; sinceMs: number };

export type GeofenceEvent =
  | { type: 'violation-started'; atMs: number }
  | { type: 'violation-cleared'; atMs: number }
  | null;

export const GEOFENCE_CONFIG = {
  OUT_OF_BOUNDS_GRACE_MS: 2500, // project requirement: 2-3 s
  MAX_ACCURACY_M: null as number | null, // null = no filtering; see "Sampling, accuracy..."
  BOUNDARY_BUFFER_M: 5, // expand playable "inside" (invisible)
  NEAR_EDGE_WARNING_M: 15, // banner when inside true arena near edge
} as const;
```

Transition rules:

- `step`, `accuracyM` is a number and `MAX_ACCURACY_M` is not null and `accuracyM > MAX_ACCURACY_M`: ignore. No state change, no event. A `null` accuracy is never ignored.
- `step`, inside fix: go to `inside`. If the previous state was `violating`, emit `violation-cleared`.
- `step`, outside fix while `inside`: go to `pending` with `outSinceMs = fix.timestampMs` (glue then wall-clock-corrects — see Timer / Stale GPS).
- `step`, outside fix while `pending`: if `fix.timestampMs - outSinceMs >= OUT_OF_BOUNDS_GRACE_MS`, go to `violating` and emit `violation-started`; otherwise stay `pending` (keep the original `outSinceMs`).
- `step`, outside fix while `violating`: no change, no event.
- `tick`, state is `pending` and `nowMs - outSinceMs >= OUT_OF_BOUNDS_GRACE_MS`: go to `violating` and emit `violation-started`. In any other state, or if the grace period hasn't elapsed: no change, no event.

## Buffer zone and near-edge warning

Two geometries (see project overview):

1. **True boundary** — placed arena polygon. Drawn on the map. Never use the buffered shape as the visible border.
2. **Playable boundary** — `buffer(trueBoundary, BOUNDARY_BUFFER_M, { units: 'meters' })` from `@turf/turf`. Feed **playable** into `isInsideBoundary` / `step` for violations. Do not draw it.

**Near-edge warning (presentation only):**

- Pure helper e.g. `isNearTrueEdge(coord, trueBoundary, warningM)` using `pointToPolygonDistance` from `@turf/turf` with `units: 'meters'`. In the installed Turf version, distance is **negative inside** the polygon and **positive outside**. Warn only when **inside the true boundary** and within `NEAR_EDGE_WARNING_M` of the edge (e.g. `-warningM <= distance <= 0`). Do **not** warn when outside the true arena (including soft buffer).
- Must never call `step`/`tick` or alter geofence status.
- Phase 2 UI: **banner** only. Future (document only): map visual such as a red gradient between the player GPS position and the true boundary — ask before implementing.

Confirm units/sign in typings before relying on other Turf distance helpers. Don't invent buffer meters beyond the named config constants.

## Match phases vs geofence

App flow (home → setup pick area → setup place arena → gameplay) lives in `.cursor/rules/project-overview.mdc`. Geofence rules apply **only in gameplay**. During setup, do not feed a live boundary into `useGeofence` (pass `null` / skip `step`) so placing or dragging the square cannot raise violations. After arena confirm, the polygon coordinates are fixed for the match — panning the camera must not move them.

## Mapbox (React Native, `@rnmapbox/maps` 10.3.0)

- This is the **native** SDK. **Do not use Mapbox GL JS web APIs** (`new mapboxgl.Map`, `map.on('load')`, `map.addSource`, `map.getSource`, `GeolocateControl`, DOM/`document`).
- Draw the boundary inside the existing `MapView` in `App.tsx` using `ShapeSource` (props `id`, `shape`) with `LineLayer` and/or `FillLayer` (props `id`, `sourceID`, `style`). Do not invent props; check `node_modules/@rnmapbox/maps/lib/typescript` for style keys.
- Keep source/layer IDs in constants and define the boundary at module scope so its object identity is stable.
- Drawing the boundary is presentation only. It is never the source of truth for violation state.
- **`PointAnnotation`:** at most **one** child view (plus an optional callout). Nested subviews throw a native error. While pan is locked for setup-place, annotation drag is unreliable — prefer **tap-to-place** (`MapView` `onPress`) to move the arena; keep the pin as a marker, not the primary control.
- On entering setup-place, call `Camera` `fitBounds` on the stock square (Turf `bbox` → NE/SW) with padding so the full arena is visible. Do **not** re-fit on every tap move. Do **not** bind `Camera` `centerCoordinate` to the moving arena pin.
- Setup-place: lock pan/scroll (`scrollEnabled` / `gestureSettings.panEnabled`); keep **zoom enabled** (`zoomEnabled`, pinch zoom). Verify props against installed typings.
- Do not mount the setup map until a GPS fix exists for the initial camera center; Mapbox’s default without a center is ~`[0,0]` (Atlantic).

## Testing (required, test-first)

The user wants tests from the start. **Write tests before or alongside the implementation, never after.** Do not consider `step`, `tick` or `isInsideBoundary` done until their tests exist and pass.

**Setup.** Jest is installed (`jest-expo` preset, `npm test`, Jest 29). Keep it that way.

`react-test-renderer` is deprecated in React 19; don't write tests directly against it. For hook/component tests later, use `@testing-library/react-native`, and check its peer dependencies when adding it. Check the Expo docs for the installed SDK if anything here seems out of date.

**Conventions.**

- Co-locate tests next to the code as `*.test.ts`.
- `step`/`tick` tests use synthetic fixes and fixed integer timestamps: no React, no device, no real timers, no `Date.now()`.
- Don't mock Turf. `isInsideBoundary` tests run the real `booleanPointInPolygon`. `@turf/turf` is expected to load under Jest via its CommonJS build, so `transformIgnorePatterns` should not be needed. If Jest fails to parse a `@turf/*` module anyway, fix it with `transformIgnorePatterns` (see the Expo docs) and tell the user; don't mock around it.

**Required cases for `step` / `tick`:**

- out for less than the grace period, then in: no violation;
- two out fixes spanning exactly the grace period: one `violation-started` (boundary is `>=`);
- `tick` just before the grace period: nothing; `tick` at or after it: exactly one `violation-started`;
- one out fix, then `tick` after the grace period with no further fix: violation (sit-still case);
- `tick` after `step` already raised the violation: no second event;
- out, in for one fix, out again: pending restarts with a new `outSinceMs`;
- return after violating: exactly one `violation-cleared`;
- low-accuracy fix during `pending` (with a non-null `MAX_ACCURACY_M`): ignored; `null` accuracy: not ignored.

**Required cases for `isInsideBoundary`:** points clearly inside, clearly outside, and exactly on the edge, in `[lng, lat]` order, with at least one test that would fail if lng/lat were swapped (use an asymmetric boundary).

**Glue hook.** Once `@testing-library/react-native` is added, test the timer behavior with Jest fake timers: the timeout is set on entering `pending`, cleared on leaving it and on unmount, and fires `tick` once. If `tick` fires before the grace period has fully elapsed, it raises no event and a new timeout is scheduled for the remaining time.

If a test fails, fix the code, not the test, unless the requirement itself changed with the user's approval.

## Don'ts

- Don't call `useGameLocation` anywhere except `App.tsx`.
- Don't swap lng/lat, and don't import `@turf/helpers` or per-function Turf packages.
- Don't invent Turf, Expo or Mapbox APIs; verify against installed typings.
- Don't rely on incoming fixes alone to enforce the grace period; the clock-based `tick` is required.
- Don't use `Date.now()` or `setTimeout` inside `step`, `tick` or `isInsideBoundary`.
- Don't hardcode the grace period or boundary coordinates inline.
- Don't emit game events from inside a reducer or during render.
- Don't weaken or delete a test to make it pass.
- Don't change the 2-3 s requirement, flag-only behavior, or location sampling/accuracy settings without the user's say-so.