import { destination, polygon } from "@turf/turf";
import type { Feature, Polygon } from "geojson";

/** Stock Phase 2 arena side length (meters). Within the 100–150 m range. */
export const STOCK_SQUARE_SIDE_M = 120;

/**
 * Axis-aligned square centered on [lng, lat], side length `sideM` meters.
 * Ring is closed (first === last). Built with Turf destination bearings.
 */
export function squarePolygonFromCenter(
  center: [number, number],
  sideM: number = STOCK_SQUARE_SIDE_M,
): Feature<Polygon> {
  const half = sideM / 2;
  const [lng, lat] = center;

  const north = destination(center, half, 0, { units: "meters" });
  const south = destination(center, half, 180, { units: "meters" });
  const northLat = north.geometry.coordinates[1];
  const southLat = south.geometry.coordinates[1];

  const nw = destination([lng, northLat], half, 270, { units: "meters" });
  const ne = destination([lng, northLat], half, 90, { units: "meters" });
  const se = destination([lng, southLat], half, 90, { units: "meters" });
  const sw = destination([lng, southLat], half, 270, { units: "meters" });

  return polygon([
    [
      nw.geometry.coordinates as [number, number],
      ne.geometry.coordinates as [number, number],
      se.geometry.coordinates as [number, number],
      sw.geometry.coordinates as [number, number],
      nw.geometry.coordinates as [number, number],
    ],
  ]);
}
