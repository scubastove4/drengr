import { forceViolation, step, tick } from "./machine";
import type { Fix, GeofenceConfig, GeofenceState } from "./types";
import { GEOFENCE_CONFIG } from "./types";

const GRACE = GEOFENCE_CONFIG.OUT_OF_BOUNDS_GRACE_MS;

function fix(
  timestampMs: number,
  accuracyM: number | null = 5,
): Fix {
  return { lng: 0, lat: 0, accuracyM, timestampMs };
}

describe("step", () => {
  it("out for less than grace then in: no violation", () => {
    let state: GeofenceState = { status: "inside" };
    let r = step(state, fix(1000), false);
    expect(r.state).toEqual({ status: "pending", outSinceMs: 1000 });
    expect(r.event).toBeNull();

    state = r.state;
    r = step(state, fix(1000 + GRACE - 1), true);
    expect(r.state).toEqual({ status: "inside" });
    expect(r.event).toBeNull();
  });

  it("two out fixes spanning exactly grace: one violation-started", () => {
    let state: GeofenceState = { status: "inside" };
    let r = step(state, fix(1000), false);
    state = r.state;
    r = step(state, fix(1000 + GRACE), false);
    expect(r.state.status).toBe("violating");
    expect(r.event).toEqual({
      type: "violation-started",
      atMs: 1000 + GRACE,
    });
  });

  it("outside while pending before grace: keeps original outSinceMs", () => {
    let state: GeofenceState = { status: "inside" };
    let r = step(state, fix(1000), false);
    state = r.state;
    r = step(state, fix(1500), false);
    expect(r.state).toEqual({ status: "pending", outSinceMs: 1000 });
    expect(r.event).toBeNull();
  });

  it("outside while violating: no change, no event", () => {
    const state: GeofenceState = { status: "violating", sinceMs: 2000 };
    const r = step(state, fix(3000), false);
    expect(r.state).toBe(state);
    expect(r.event).toBeNull();
  });

  it("out, in for one fix, out again: pending restarts with new outSinceMs", () => {
    let state: GeofenceState = { status: "inside" };
    let r = step(state, fix(1000), false);
    state = r.state;
    r = step(state, fix(1500), true);
    state = r.state;
    expect(state).toEqual({ status: "inside" });
    r = step(state, fix(2000), false);
    expect(r.state).toEqual({ status: "pending", outSinceMs: 2000 });
    expect(r.event).toBeNull();
  });

  it("return after violating: exactly one violation-cleared", () => {
    const state: GeofenceState = { status: "violating", sinceMs: 2000 };
    const r = step(state, fix(4000), true);
    expect(r.state).toEqual({ status: "inside" });
    expect(r.event).toEqual({ type: "violation-cleared", atMs: 4000 });
  });

  it("low-accuracy fix during pending is ignored when MAX_ACCURACY_M is set", () => {
    const config: GeofenceConfig = {
      ...GEOFENCE_CONFIG,
      MAX_ACCURACY_M: 20,
    };
    const state: GeofenceState = { status: "pending", outSinceMs: 1000 };
    const r = step(state, fix(1000 + GRACE, 50), false, config);
    expect(r.state).toBe(state);
    expect(r.event).toBeNull();
  });

  it("null accuracy is not ignored when MAX_ACCURACY_M is set", () => {
    const config: GeofenceConfig = {
      ...GEOFENCE_CONFIG,
      MAX_ACCURACY_M: 20,
    };
    const state: GeofenceState = { status: "pending", outSinceMs: 1000 };
    const r = step(state, fix(1000 + GRACE, null), false, config);
    expect(r.state.status).toBe("violating");
    expect(r.event?.type).toBe("violation-started");
  });
});

describe("tick", () => {
  it("just before grace: nothing; at or after grace: one violation-started", () => {
    const state: GeofenceState = { status: "pending", outSinceMs: 1000 };
    const early = tick(state, 1000 + GRACE - 1);
    expect(early.state).toBe(state);
    expect(early.event).toBeNull();

    const due = tick(state, 1000 + GRACE);
    expect(due.state.status).toBe("violating");
    expect(due.event).toEqual({
      type: "violation-started",
      atMs: 1000 + GRACE,
    });
  });

  it("one out fix then tick after grace with no further fix: violation", () => {
    let state: GeofenceState = { status: "inside" };
    const r = step(state, fix(1000), false);
    state = r.state;
    const t = tick(state, 1000 + GRACE);
    expect(t.state.status).toBe("violating");
    expect(t.event?.type).toBe("violation-started");
  });

  it("tick after step already raised violation: no second event", () => {
    const state: GeofenceState = { status: "violating", sinceMs: 3500 };
    const t = tick(state, 5000);
    expect(t.state).toBe(state);
    expect(t.event).toBeNull();
  });

  it("tick in inside state: no change", () => {
    const state: GeofenceState = { status: "inside" };
    const t = tick(state, 9999);
    expect(t.state).toBe(state);
    expect(t.event).toBeNull();
  });
});

describe("forceViolation", () => {
  it("pending becomes violating with one violation-started", () => {
    const state: GeofenceState = { status: "pending", outSinceMs: 1000 };
    const r = forceViolation(state, 1200);
    expect(r.state).toEqual({ status: "violating", sinceMs: 1200 });
    expect(r.event).toEqual({ type: "violation-started", atMs: 1200 });
  });

  it("already violating: no second event", () => {
    const state: GeofenceState = { status: "violating", sinceMs: 2000 };
    const r = forceViolation(state, 3000);
    expect(r.state).toBe(state);
    expect(r.event).toBeNull();
  });

  it("inside: no change", () => {
    const state: GeofenceState = { status: "inside" };
    const r = forceViolation(state, 3000);
    expect(r.state).toBe(state);
    expect(r.event).toBeNull();
  });
});
