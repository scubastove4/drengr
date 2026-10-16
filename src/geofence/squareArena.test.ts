import { distance } from "@turf/turf";
import { isInsideBoundary } from "./isInsideBoundary";
import {
  squarePolygonFromCenter,
  STOCK_SQUARE_SIDE_M,
} from "./squareArena";

describe("squarePolygonFromCenter", () => {
  const center: [number, number] = [174.76, -36.85];

  it("returns a closed ring", () => {
    const poly = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);
    const ring = poly.geometry.coordinates[0];
    expect(ring.length).toBeGreaterThanOrEqual(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("has side length approximately STOCK_SQUARE_SIDE_M", () => {
    const poly = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);
    const [nw, ne, se] = poly.geometry.coordinates[0];
    const widthM = distance(nw, ne, { units: "meters" });
    const heightM = distance(ne, se, { units: "meters" });
    expect(widthM).toBeCloseTo(STOCK_SQUARE_SIDE_M, 0);
    expect(heightM).toBeCloseTo(STOCK_SQUARE_SIDE_M, 0);
  });

  it("contains the center and excludes a point well outside", () => {
    const poly = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);
    expect(isInsideBoundary(center, poly)).toBe(true);
    expect(isInsideBoundary([center[0] + 0.01, center[1]], poly)).toBe(false);
  });
});
