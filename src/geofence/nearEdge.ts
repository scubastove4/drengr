import { pointToPolygonDistance } from "@turf/turf";
import type { BoundaryPolygon } from "./isInsideBoundary";
import { GEOFENCE_CONFIG } from "./types";

/**
 * True when inside the true boundary and within `warningM` of its edge.
 * Turf `pointToPolygonDistance` is negative inside, positive outside.
 * Presentation only — never feed into step/tick.
 */
export function isNearTrueEdge(
  coord: [number, number],
  trueBoundary: BoundaryPolygon,
  warningM: number = GEOFENCE_CONFIG.NEAR_EDGE_WARNING_M,
): boolean {
  const distanceM = pointToPolygonDistance(coord, trueBoundary, {
    units: "meters",
  });
  return distanceM <= 0 && distanceM >= -warningM;
}
