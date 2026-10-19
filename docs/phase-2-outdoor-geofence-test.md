# Phase 2 — Outdoor geofence test plan

Physical-device walkthrough for the stock square, grace period, playable buffer (~5 m), and near-edge warning (~15 m). Use this after indoor/device checks (setup flow, soft-shoulder in-bounds) and before calling Phase 2 done.

## Why this setup (Expo dev client)

Drengr’s day-to-day build is a **dev client**. JavaScript loads from **Metro**, not an embedded bundle. You cannot unplug, walk away, and expect the app to keep working unless Metro stays reachable (or you later use a release build).

**Recommended:** phone **Personal Hotspot** → Mac joins that hotspot → Metro on the Mac → open Drengr on the phone. Walk with the phone; keep the Mac nearby (bag/bench) so the packager stays up.

You do **not** need Location “Always” or background location modes for this test (foreground / while using only).

## Before you leave

1. Phone charged; Mac charged (or power bank).
2. Dev client already installed on the phone (USB + Xcode or `npm run ios -- --device` once is enough).
3. On the phone: Settings → Personal Hotspot → allow others to join; note the password.
4. On the Mac: join the phone’s hotspot Wi‑Fi.
5. In the project root:

   ```bash
   cd /Users/MacBookPro/Desktop/Projects/drengr
   npx expo start --dev-client
   ```

6. **Check Metro’s URL in the terminal** (the window where `expo start` is running). Look for a line like:

   ```text
   Metro waiting on exp://192.168.x.x:8081
   ```

   or (dev client) something with `http://192.168.x.x:8081`.

   - **Good:** an IP that is **not** `127.0.0.1` / `localhost` — often `172.20.10.x` on iPhone Personal Hotspot, or `192.168.x.x` on home Wi‑Fi.
   - **Bad / incomplete:** only `localhost` or `127.0.0.1`. The phone cannot reach that. Join the hotspot first, then restart Metro (`Ctrl+C`, then `npx expo start --dev-client` again). Press `s` if it says Expo Go so it targets the **development build**.

   To see the Mac’s IP yourself: **System Settings → Wi‑Fi →** your hotspot network **→ Details** (IP address), or in Terminal: `ipconfig getifaddr en0` (try `en1` if empty).

7. **Launch via Xcode (recommended if the app shows “No script URL”).** With Metro already running and the Mac on the hotspot:
   1. Plug the iPhone in over USB (unlock + Trust if asked).
   2. Open the workspace: `open ios/Drengr.xcworkspace` (use **`.xcworkspace`**, not `.xcodeproj`).
   3. In the Xcode toolbar, select your **iPhone** as the run destination (not a simulator).
   4. Press **Run** (▶). Xcode installs/launches Drengr and usually wires it to Metro so the script URL error goes away.
   5. You can unplug afterward if the phone stays on the hotspot and Metro stays up; keep the Mac awake.

   **Alternatives** if you prefer not to use Xcode for this step:
   - Scan the QR code in the Metro terminal with the iPhone Camera, then open in the Drengr dev client.
   - Open this deep link on the phone (IP must match step 6), e.g.  
     `dev.drengr.app://expo-development-client/?url=http://172.20.10.3:8081`
   - Shake / three-finger tap → Configure bundler → `MAC_IP:8081` (shake is unreliable on some iPhones).

8. Location permission: **While Using the App**.
9. In `__DEV__` you should see:
   - **Solid** outline = true arena  
   - **Dashed orange** outline = playable buffer (+5 m)

## Setup on site

1. Open sky if possible (avoid deep courtyards / tall buildings for the first pass).
2. Complete setup: pan → **Confirm area** → tap to place square → **Confirm arena** → you should land in **lobby** (geofence still off) → **Start match** when ready to begin the walk.
3. Place the arena so you can walk cleanly:
   - across the true edge into the soft shoulder  
   - then out past the dashed buffer  
   - and back in again  

## Checklist

Record pass/fail and rough notes (time of day, sky, anything odd). Banner labels: **In bounds** / **Near boundary** / **Leaving arena…** / **OUT OF BOUNDS**.

| # | Action | Expected |
|---|--------|----------|
| 1 | Stand well inside the true square | **In bounds**; no near-edge banner |
| 2 | Walk toward the true edge; stop ~10 m inside the line | **Near boundary** (within ~15 m of true edge) |
| 3 | Cross the true line; stay inside the dashed buffer | Still **In bounds** (or near-edge clears — not OOB). Soft shoulder working |
| 4 | Cross the dashed buffer and **stand still** | After ~2.5 s: **Leaving arena…** then **OUT OF BOUNDS** (grace + `tick`; don’t need to keep walking) |
| 5 | Walk back inside the true square (move enough for a new GPS fix; iOS often needs ~5 m) | Returns to **In bounds** (may take a few seconds / some movement) |
| 6 | Confirm arena, stand outside the buffer in **lobby**, then **Start match** and stand still | Geofence off in lobby; after start, ~2.5 s wall-clock → pending → **OUT OF BOUNDS** |
| 7 | (Optional) Revoke location in Settings mid-`pending`/`violating` | Document what happens; full AppState re-check may still be unfinished |

Already verified indoors/on device (no need to re-prove unless regressing): standing between true and buffer shows in-bounds.

## Results log

### Outing 1 (quick pass — retest before closing Phase 2)

| Check | Result | Notes |
|---|---|---|
| Confirm location | Pass | |
| Place arena | Pass | |
| Lobby until Start match | Pass | |
| Near true boundary → warning | Pass | |
| Leave near-edge zone → warning clears | Pass | Felt late — banner stayed until well past ~15 m (likely GPS / 5 m sampling lag) |
| Between buffer and true → no violation | Pass | Banner sequence messy: can show Near boundary then In bounds while in the soft shoulder |
| Leave buffer → “Leaving arena…” | Pass | |
| Sit ~2.5 s → OUT OF BOUNDS | Pass | |
| Violation clears after re-entering | Pass | Didn’t note whether clear used buffer or true boundary — check next outing |
| Start match already outside buffer → flag | **Not run** | Do next outing (checklist #6) |

**General notes (outing 1):** Good overall; need a second walk. Switching to other apps left the match in memory; **force-closing Drengr ended the match** (expected without persistence). Product follow-ups: **End match** button; do not rely on blocking iOS force-quit (impossible) — later optional persist/resume if wanted.

## Later: Phase 3 multiplayer check

Not part of this outing. After Phase 3 (home invites + Firebase sync): confirm that a player who is **OUT OF BOUNDS** is revealed on other players’ maps as designed.

## What to watch for

- **Sticky OOB when re-entering:** often GPS sampling (move ~5 m), not a logic bug. Note whether buffer made edge flicker better.
- **Near-edge only inside true arena:** should not show “Near boundary” when you’re only in the soft shoulder outside the solid line.
- **False OOB mid-map:** unexpected; note GPS accuracy from the HUD and surroundings.
- Metro drops when you walk too far from the Mac → app may red-screen; move closer and reload.

## After the walk

1. Update Phase 2 notes in `.cursor/rules/project-overview.mdc` (what passed / what to tune).
2. Only change `BOUNDARY_BUFFER_M` / `NEAR_EDGE_WARNING_M` if outdoor results clearly justify it — ask before inventing new numbers.
3. Defer: teleport/impossible-jump filters, dynamic accuracy, near-edge map gradient, safe-area `fitBounds` padding.

## Alternatives (if hotspot is awkward)

| Approach | When |
|----------|------|
| Same home Wi‑Fi outdoors | Yard/street still reaches the AP |
| USB + short walk near the Mac | Quick smoke only |
| Release / embedded-JS build later | True untethered field tests without Metro |

## Out of scope for this outing

- Multiplayer / Firebase / invites (Phase 3; see above)  
- Hit range / shooting  
- Background GPS  
- Venue restrictions (Phase 10)  
- Simulator GPX (useful indoors for flow; does not replace real GPS for buffer tuning)
