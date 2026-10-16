import { squarePolygonFromCenter, STOCK_SQUARE_SIDE_M } from "./squareArena";
import { isNearTrueEdge } from "./nearEdge";
import { GEOFENCE_CONFIG } from "./types";

describe("isNearTrueEdge", () => {
  const center: [number, number] = [174.76, -36.85];
  const trueBoundary = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);
  const metersToDegLat = (m: number) => m / 111_320;

  it("is false at the center (far from edge)", () => {
    expect(isNearTrueEdge(center, trueBoundary)).toBe(false);
  });

  it("is true inside true arena within warning distance of the edge", () => {
    const nearNorthInside: [number, number] = [
      center[0],
      center[1] +
        metersToDegLat(STOCK_SQUARE_SIDE_M / 2 - 5),
    ];
    expect(
      isNearTrueEdge(
        nearNorthInside,
        trueBoundary,
        GEOFENCE_CONFIG.NEAR_EDGE_WARNING_M,
      ),
    ).toBe(true);
  });

  it("is false outside the true arena (including soft buffer)", () => {
    const justOutside: [number, number] = [
      center[0],
      center[1] + metersToDegLat(STOCK_SQUARE_SIDE_M / 2 + 2),
    ];
    expect(isNearTrueEdge(justOutside, trueBoundary)).toBe(false);
  });
});
