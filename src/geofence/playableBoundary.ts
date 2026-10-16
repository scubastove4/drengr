import { buffer } from "@turf/turf";
import type { BoundaryPolygon } from "./isInsideBoundary";
import { GEOFENCE_CONFIG } from "./types";

/**
 * Expand the true arena outward for GPS jitter tolerance.
 * Result is for violation checks only — do not draw it.
 */
export function playableBoundaryFromTrue(
  trueBoundary: BoundaryPolygon,
  bufferM: number = GEOFENCE_CONFIG.BOUNDARY_BUFFER_M,
): BoundaryPolygon {
  const buffered = buffer(trueBoundary, bufferM, { units: "meters" });
  if (
    buffered == null ||
    (buffered.geometry.type !== "Polygon" &&
      buffered.geometry.type !== "MultiPolygon")
  ) {
    return trueBoundary;
  }
  return buffered as BoundaryPolygon;
}
