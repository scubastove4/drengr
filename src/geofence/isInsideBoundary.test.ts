import { polygon } from "@turf/turf";
import { isInsideBoundary } from "./isInsideBoundary";

/** Asymmetric: wide E–W (~0.02° lng), short N–S (~0.01° lat), not a square. */
const ASYMMETRIC = polygon([
  [
    [10.0, 20.0],
    [10.02, 20.0],
    [10.02, 20.01],
    [10.0, 20.01],
    [10.0, 20.0],
  ],
]);

describe("isInsideBoundary", () => {
  it("returns true for a point clearly inside", () => {
    expect(isInsideBoundary([10.01, 20.005], ASYMMETRIC)).toBe(true);
  });

  it("returns false for a point clearly outside", () => {
    expect(isInsideBoundary([10.05, 20.005], ASYMMETRIC)).toBe(false);
  });

  it("returns true for a point exactly on the edge", () => {
    expect(isInsideBoundary([10.01, 20.0], ASYMMETRIC)).toBe(true);
  });

  it("fails if lng/lat were swapped (asymmetric boundary)", () => {
    // Correct order [lng, lat] is inside.
    expect(isInsideBoundary([10.015, 20.005], ASYMMETRIC)).toBe(true);
    // Swapped [lat, lng] would be far outside this polygon.
    expect(isInsideBoundary([20.005, 10.015], ASYMMETRIC)).toBe(false);
  });
});
