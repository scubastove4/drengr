import type {
  Fix,
  GeofenceConfig,
  GeofenceEvent,
  GeofenceState,
} from "./types";
import { GEOFENCE_CONFIG } from "./types";

export type StepResult = { state: GeofenceState; event: GeofenceEvent };

export function step(
  state: GeofenceState,
  fix: Fix,
  isInside: boolean,
  config: GeofenceConfig = GEOFENCE_CONFIG,
): StepResult {
  if (
    fix.accuracyM != null &&
    config.MAX_ACCURACY_M != null &&
    fix.accuracyM > config.MAX_ACCURACY_M
  ) {
    return { state, event: null };
  }

  if (isInside) {
    if (state.status === "violating") {
      return {
        state: { status: "inside" },
        event: { type: "violation-cleared", atMs: fix.timestampMs },
      };
    }
    return { state: { status: "inside" }, event: null };
  }

  // outside
  if (state.status === "inside") {
    return {
      state: { status: "pending", outSinceMs: fix.timestampMs },
      event: null,
    };
  }

  if (state.status === "pending") {
    if (
      fix.timestampMs - state.outSinceMs >=
      config.OUT_OF_BOUNDS_GRACE_MS
    ) {
      return {
        state: { status: "violating", sinceMs: fix.timestampMs },
        event: { type: "violation-started", atMs: fix.timestampMs },
      };
    }
    return { state, event: null };
  }

  // violating + outside
  return { state, event: null };
}

export function tick(
  state: GeofenceState,
  nowMs: number,
  config: GeofenceConfig = GEOFENCE_CONFIG,
): StepResult {
  if (state.status !== "pending") {
    return { state, event: null };
  }
  if (nowMs - state.outSinceMs >= config.OUT_OF_BOUNDS_GRACE_MS) {
    return {
      state: { status: "violating", sinceMs: nowMs },
      event: { type: "violation-started", atMs: nowMs },
    };
  }
  return { state, event: null };
}

/** Skip remaining grace when location permission is revoked while out. */
export function forceViolation(
  state: GeofenceState,
  atMs: number,
): StepResult {
  if (state.status === "pending") {
    return {
      state: { status: "violating", sinceMs: atMs },
      event: { type: "violation-started", atMs },
    };
  }
  return { state, event: null };
}
