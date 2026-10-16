import { squarePolygonFromCenter, STOCK_SQUARE_SIDE_M } from "./squareArena";
import { isInsideBoundary } from "./isInsideBoundary";
import { playableBoundaryFromTrue } from "./playableBoundary";
import { GEOFENCE_CONFIG } from "./types";

describe("playableBoundaryFromTrue", () => {
  const center: [number, number] = [174.76, -36.85];
  const trueBoundary = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);

  it("keeps the center inside", () => {
    const playable = playableBoundaryFromTrue(trueBoundary);
    expect(isInsideBoundary(center, playable)).toBe(true);
  });

  it("counts a point just outside the true edge as inside playable", () => {
    // ~2 m north of the north edge of a 120 m square → outside true, inside +5 m buffer
    const justOutsideNorth: [number, number] = [
      center[0],
      center[1] + (STOCK_SQUARE_SIDE_M / 2 + 2) / 111_320,
    ];
    expect(isInsideBoundary(justOutsideNorth, trueBoundary)).toBe(false);
    const playable = playableBoundaryFromTrue(
      trueBoundary,
      GEOFENCE_CONFIG.BOUNDARY_BUFFER_M,
    );
    expect(isInsideBoundary(justOutsideNorth, playable)).toBe(true);
  });

  it("still excludes a point well outside the buffer", () => {
    const farNorth: [number, number] = [
      center[0],
      center[1] + (STOCK_SQUARE_SIDE_M / 2 + 40) / 111_320,
    ];
    const playable = playableBoundaryFromTrue(trueBoundary);
    expect(isInsideBoundary(farNorth, playable)).toBe(false);
  });
});
