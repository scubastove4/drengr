export { isInsideBoundary } from "./isInsideBoundary";
export type { BoundaryPolygon } from "./isInsideBoundary";
export { step, tick, forceViolation } from "./machine";
export type { StepResult } from "./machine";
export {
  squarePolygonFromCenter,
  STOCK_SQUARE_SIDE_M,
} from "./squareArena";
export { playableBoundaryFromTrue } from "./playableBoundary";
export { isNearTrueEdge } from "./nearEdge";
export {
  GEOFENCE_CONFIG,
  type Fix,
  type GeofenceConfig,
  type GeofenceEvent,
  type GeofenceState,
} from "./types";
