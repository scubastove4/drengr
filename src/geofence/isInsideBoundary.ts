import { booleanPointInPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type BoundaryPolygon = Feature<Polygon | MultiPolygon>;

/** Point-in-polygon for geofence rules. Coord is [lng, lat]. Edge counts as inside. */
export function isInsideBoundary(
  coord: [number, number],
  boundary: BoundaryPolygon,
): boolean {
  return booleanPointInPolygon(coord, boundary);
}
