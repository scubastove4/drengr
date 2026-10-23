# Drengr

Real-world multiplayer mobile game: outdoor spaces become GPS arenas. Your phone is the HUD (and later, the weapon). Other players stay hidden unless an action reveals them (shooting or leaving the geofence).

**Platform:** iOS-first (dev builds on a physical iPhone). Android is not a focus yet. **Expo Go does not work** — Mapbox needs a native dev client.

Product vision, roadmap, data/privacy rules, and architecture live in [`.cursor/rules/project-overview.mdc`](.cursor/rules/project-overview.mdc). Git branching is in [`.cursor/rules/git-branching.mdc`](.cursor/rules/git-branching.mdc). Outdoor geofence testing: [`docs/phase-2-outdoor-geofence-test.md`](docs/phase-2-outdoor-geofence-test.md).

## Prerequisites

- **Node** `24.15.0` (see [`.nvmrc`](.nvmrc); engines allow `>=20.19.4`)
- **npm** `>=10`
- **Xcode** with a signing team (free Apple ID is fine for device installs; builds expire after ~7 days)
- **CocoaPods** via Homebrew (`1.16+`), not the old system Ruby gem
- A **Mapbox** account and public access token (below)
- Physical **iPhone** for real GPS (Simulator location is fake / San Francisco by default)

## Mapbox access token

The map uses `@rnmapbox/maps` with a **public** token (`pk.…`). It is read from `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and inlined at bundle time (`babel.config.js` + `babel-preset-expo`).

1. Create a free account at [https://account.mapbox.com/](https://account.mapbox.com/).
2. Open [Access tokens](https://account.mapbox.com/access-tokens/).
3. Copy the **Default public token**, or create one with public scopes (at least styles/tiles as Mapbox documents for client maps).
4. In the project root, copy the example env file and paste your token:

   ```bash
   cp .env.example .env
   ```

   ```bash
   # .env
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
   ```

5. Restart Metro after changing `.env` so the new value is picked up.

Do **not** commit `.env`. `.env.example` stays in git without a real secret. Prefer a public `pk.` token in the app — never put a secret `sk.` token in the mobile client.

## Setup

```bash
git clone <your-remote-url> drengr
cd drengr
nvm use   # or install Node 24.15.0
npm install
cp .env.example .env   # then add your Mapbox token
```

Generate native projects if `ios/` is missing (this repo often gitignores generated native folders):

```bash
npx expo prebuild
npm run ios:pods   # Homebrew CocoaPods + SSL paths
```

Install a **dev client** on the Simulator or a device (not Expo Go):

```bash
npm run ios
# or open ios/Drengr.xcworkspace in Xcode, pick your iPhone, Run
```

## Day-to-day outdoor test run

Use two terminals from the project root. Prefer the **project-local** Expo CLI (`npx expo` / `npm start`), not a global legacy `expo-cli`.

**1. Metro (dev client mode):**

```bash
npx expo start --dev-client
```

Confirm the terminal shows a LAN URL (e.g. `http://192.168.x.x:8081` or `172.20.10.x` on Personal Hotspot), not only `localhost`.

**2. Open the app** on the already-installed Drengr build (home screen icon), or Run again from Xcode with Metro already up.

If you see **“No script URL provided”**, the usual fix is: Metro running → Mac and phone on the same network (or phone hotspot) → Run from Xcode once so the client picks up the bundler. More detail (QR, deep link, hotspot outdoor setup) is in [`docs/phase-2-outdoor-geofence-test.md`](docs/phase-2-outdoor-geofence-test.md).

### Useful scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo start (use `--dev-client` for this app) |
| `npm run ios` | Build/run iOS with Homebrew CocoaPods PATH/SSL |
| `npm run ios:pods` | `pod install` in `ios/` |
| `npm test` | Jest (`jest-expo`) |
| `npx expo prebuild` | Regenerate `ios/` / `android/` |

## Current app flow (Phase 2)

1. **Pick area** — pan/zoom the map, Confirm area  
2. **Place arena** — 120 m stock square; tap to move; Confirm arena  
3. **Lobby** — arena locked; geofence off; **Start match** when ready; **Change area** restarts full setup  
4. **Gameplay** — geofence on (grace period, playable buffer, near-edge banner). **☰** menu → End match (confirm) returns to lobby.

In `__DEV__`, a dashed outline shows the invisible +5 m playable buffer. Release builds show the true arena only.

## Tests

```bash
npm test
```

Game rules live under `src/geofence/` as pure functions with co-located `*.test.ts` files (no React/`Date.now()` in the pure layer). The geofence glue hook is covered in `src/hooks/useGeofence.test.ts`. See the Testing section in [`.cursor/rules/project-overview.mdc`](.cursor/rules/project-overview.mdc).

## Project docs

| Doc | Contents |
|-----|----------|
| [`.cursor/rules/project-overview.mdc`](.cursor/rules/project-overview.mdc) | Vision, phases, privacy, tuning, app flow, wrap-up |
| [`.cursor/rules/git-branching.mdc`](.cursor/rules/git-branching.mdc) | `main` / `release/*` / `feature/*` (full rules from Phase 3) |
| [`.cursor/skills/geofence-boundary/SKILL.md`](.cursor/skills/geofence-boundary/SKILL.md) | Geofence implementation rules for contributors/agents |
| [`docs/phase-2-outdoor-geofence-test.md`](docs/phase-2-outdoor-geofence-test.md) | Device outdoor checklist + results log |

## Privacy (short)

Location is for active play only. The live match holds the **current** position, not a path history. Design goal: delete live match location data when the match ends; persist stats and arena shapes, not coordinates. See the privacy rule in the project overview.
