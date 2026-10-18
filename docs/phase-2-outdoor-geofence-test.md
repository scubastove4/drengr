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

6. Confirm Metro shows a LAN URL (hotspot subnet), not only `localhost`.
7. Open **Drengr** on the phone. If you see “No script URL”, set the bundler host to the Mac’s hotspot IP and port `8081` (shake device → configure bundler), or reload after Metro is up.
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
