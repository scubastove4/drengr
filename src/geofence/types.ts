export type Fix = {
  lng: number;
  lat: number;
  accuracyM: number | null;
  timestampMs: number;
};

export type GeofenceState =
  | { status: "inside" }
  | { status: "pending"; outSinceMs: number }
  | { status: "violating"; sinceMs: number };

export type GeofenceEvent =
  | { type: "violation-started"; atMs: number }
  | { type: "violation-cleared"; atMs: number }
  | null;

export const GEOFENCE_CONFIG = {
  OUT_OF_BOUNDS_GRACE_MS: 2500,
  MAX_ACCURACY_M: null as number | null,
  BOUNDARY_BUFFER_M: 5,
  NEAR_EDGE_WARNING_M: 15,
} as const;

export type GeofenceConfig = {
  OUT_OF_BOUNDS_GRACE_MS: number;
  MAX_ACCURACY_M: number | null;
  BOUNDARY_BUFFER_M: number;
  NEAR_EDGE_WARNING_M: number;
};
