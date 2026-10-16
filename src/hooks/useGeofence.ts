import { useEffect, useRef, useState } from "react";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import {
  forceViolation,
  GEOFENCE_CONFIG,
  isInsideBoundary,
  step,
  tick,
  type Fix,
  type GeofenceEvent,
  type GeofenceState,
} from "../geofence";
import type { GameLocationFix } from "./useGameLocation";

export type UseGeofenceOptions = {
  permissionGranted: boolean;
  onEvent?: (event: Exclude<GeofenceEvent, null>) => void;
};

function toFix(gameFix: GameLocationFix): Fix {
  return {
    lng: gameFix.longitude,
    lat: gameFix.latitude,
    accuracyM: gameFix.accuracyM,
    timestampMs: gameFix.timestamp,
  };
}

/**
 * Geofence glue: runs pure step/tick against useGameLocation's fix.
 * Call only from App.tsx, directly under useGameLocation (before early returns).
 */
export function useGeofence(
  fix: GameLocationFix | null,
  boundary: Feature<Polygon | MultiPolygon> | null,
  { permissionGranted, onEvent }: UseGeofenceOptions,
) {
  const stateRef = useRef<GeofenceState>({ status: "inside" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const wasGrantedRef = useRef(permissionGranted);

  const [status, setStatus] = useState<GeofenceState["status"]>("inside");

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const applyResult = (result: {
    state: GeofenceState;
    event: GeofenceEvent;
  }) => {
    stateRef.current = result.state;
    setStatus(result.state.status);
    if (result.event) {
      onEventRef.current?.(result.event);
    }
  };

  const scheduleTick = (outSinceMs: number) => {
    clearTimer();
    const delay = Math.max(
      0,
      outSinceMs + GEOFENCE_CONFIG.OUT_OF_BOUNDS_GRACE_MS - Date.now(),
    );
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const result = tick(stateRef.current, Date.now());
      applyResult(result);
      if (stateRef.current.status === "pending") {
        scheduleTick(stateRef.current.outSinceMs);
      }
    }, delay);
  };

  // Fix / boundary updates
  useEffect(() => {
    if (!fix || !boundary) return;

    const prevStatus = stateRef.current.status;
    const geofenceFix = toFix(fix);
    const inside = isInsideBoundary(
      [geofenceFix.lng, geofenceFix.lat],
      boundary,
    );
    const result = step(stateRef.current, geofenceFix, inside);

    // Wall-clock grace: iOS fix timestamps can be stale while stationary.
    if (prevStatus !== "pending" && result.state.status === "pending") {
      const pending = {
        status: "pending" as const,
        outSinceMs: Date.now(),
      };
      applyResult({ state: pending, event: result.event });
      scheduleTick(pending.outSinceMs);
      return;
    }

    applyResult(result);

    if (stateRef.current.status === "pending") {
      scheduleTick(stateRef.current.outSinceMs);
    } else {
      clearTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleTick/applyResult are stable helpers over refs
  }, [fix, boundary]);

  // Permission revoke while out → immediate violation
  useEffect(() => {
    const wasGranted = wasGrantedRef.current;
    wasGrantedRef.current = permissionGranted;

    if (wasGranted && !permissionGranted) {
      const current = stateRef.current;
      if (current.status === "pending" || current.status === "violating") {
        clearTimer();
        applyResult(forceViolation(current, Date.now()));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionGranted]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return { status };
}
