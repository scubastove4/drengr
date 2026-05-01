import * as Location from "expo-location";
import { point } from "@turf/turf";
import { useCallback, useEffect, useRef, useState } from "react";

export type GameLocationFix = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  timestamp: number;
};

const TIME_MS = 4000;
const DISTANCE_M = 5;

/**
 * Foreground GPS stream for HUD / game logic. Map follow uses Mapbox UserLocation separately.
 * Throttles by movement (~5 m) and time (~4 s) via expo-location options.
 */
export function useGameLocation(enabled: boolean) {
  const [permission, setPermission] =
    useState<Location.PermissionStatus | null>(null);
  const [fix, setFix] = useState<GameLocationFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
    return status === Location.PermissionStatus.GRANTED;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!cancelled) setPermission(status);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || permission !== Location.PermissionStatus.GRANTED) {
      sub.current?.remove();
      sub.current = null;
      return;
    }

    let alive = true;
    (async () => {
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: TIME_MS,
            distanceInterval: DISTANCE_M,
          },
          (loc) => {
            if (!alive) return;
            setError(null);
            setFix({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracyM: loc.coords.accuracy ?? null,
              headingDeg: loc.coords.heading ?? null,
              speedMps: loc.coords.speed ?? null,
              timestamp: loc.timestamp,
            });
          },
        );
        if (!alive) {
          subscription.remove();
          return;
        }
        sub.current = subscription;
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Location error");
      }
    })();

    return () => {
      alive = false;
      sub.current?.remove();
      sub.current = null;
    };
  }, [enabled, permission]);

  const turfPoint = fix ? point([fix.longitude, fix.latitude]) : null;

  return {
    permission,
    requestPermission,
    fix,
    error,
    turfPoint,
    stream: { timeIntervalMs: TIME_MS, distanceIntervalM: DISTANCE_M },
  };
}
