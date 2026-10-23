import { act, renderHook } from "@testing-library/react-native";
import {
  GEOFENCE_CONFIG,
  squarePolygonFromCenter,
  STOCK_SQUARE_SIDE_M,
} from "../geofence";
import type { GameLocationFix } from "./useGameLocation";
import { useGeofence } from "./useGeofence";

const GRACE = GEOFENCE_CONFIG.OUT_OF_BOUNDS_GRACE_MS;
const CENTER: [number, number] = [174.76, -36.85];
const BOUNDARY = squarePolygonFromCenter(CENTER, STOCK_SQUARE_SIDE_M);

/** ~80 m north of center → outside a 120 m square. */
const OUTSIDE: GameLocationFix = {
  latitude: CENTER[1] + 80 / 111_320,
  longitude: CENTER[0],
  accuracyM: 5,
  headingDeg: null,
  speedMps: null,
  timestamp: 1_000_000,
};

const INSIDE: GameLocationFix = {
  latitude: CENTER[1],
  longitude: CENTER[0],
  accuracyM: 5,
  headingDeg: null,
  speedMps: null,
  timestamp: 1_000_000,
};

type HookResult = { status: "inside" | "pending" | "violating" };

describe("useGeofence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(2_000_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("null fix or null boundary is a no-op (stays inside)", async () => {
    type Props = {
      fix: GameLocationFix | null;
      boundary: typeof BOUNDARY | null;
    };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ fix, boundary }) =>
        useGeofence(fix, boundary, { permissionGranted: true }),
      {
        initialProps: { fix: null, boundary: BOUNDARY },
      },
    );
    expect(result.current?.status).toBe("inside");

    await rerender({ fix: OUTSIDE, boundary: null });
    expect(result.current?.status).toBe("inside");
  });

  it("schedules tick on pending and violates after wall-clock grace", async () => {
    const onEvent = jest.fn();
    // Stale GPS timestamp: well before Date.now() (2_000_000).
    const staleOut: GameLocationFix = { ...OUTSIDE, timestamp: 1000 };

    const { result } = await renderHook<HookResult, void>(() =>
      useGeofence(staleOut, BOUNDARY, { permissionGranted: true, onEvent }),
    );

    expect(result.current?.status).toBe("pending");
    expect(onEvent).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(GRACE - 1);
    });
    expect(result.current?.status).toBe("pending");

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current?.status).toBe("violating");
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      type: "violation-started",
    });
  });

  it("clears pending timer when returning inside before grace", async () => {
    const onEvent = jest.fn();
    type Props = { fix: GameLocationFix };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ fix }) =>
        useGeofence(fix, BOUNDARY, { permissionGranted: true, onEvent }),
      { initialProps: { fix: OUTSIDE } },
    );
    expect(result.current?.status).toBe("pending");

    await rerender({ fix: { ...INSIDE, timestamp: 2_000_100 } });
    expect(result.current?.status).toBe("inside");

    await act(async () => {
      jest.advanceTimersByTime(GRACE + 500);
    });
    expect(result.current?.status).toBe("inside");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("clears timer on unmount without raising a late violation", async () => {
    const onEvent = jest.fn();
    const { result, unmount } = await renderHook<HookResult, void>(() =>
      useGeofence(OUTSIDE, BOUNDARY, { permissionGranted: true, onEvent }),
    );
    expect(result.current?.status).toBe("pending");
    await unmount();

    await act(async () => {
      jest.advanceTimersByTime(GRACE + 500);
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("resets and clears timer when boundary becomes null while pending", async () => {
    const onEvent = jest.fn();
    type Props = { boundary: typeof BOUNDARY | null };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ boundary }) =>
        useGeofence(OUTSIDE, boundary, { permissionGranted: true, onEvent }),
      { initialProps: { boundary: BOUNDARY } },
    );
    expect(result.current?.status).toBe("pending");

    await rerender({ boundary: null });
    expect(result.current?.status).toBe("inside");

    await act(async () => {
      jest.advanceTimersByTime(GRACE + 500);
    });
    expect(result.current?.status).toBe("inside");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("force-violates when permission is revoked while pending", async () => {
    const onEvent = jest.fn();
    type Props = { granted: boolean };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ granted }) =>
        useGeofence(OUTSIDE, BOUNDARY, {
          permissionGranted: granted,
          onEvent,
        }),
      { initialProps: { granted: true } },
    );
    expect(result.current?.status).toBe("pending");

    await rerender({ granted: false });
    expect(result.current?.status).toBe("violating");
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "violation-started" }),
    );
  });

  it("does not emit a second violation-started if already violating on revoke", async () => {
    const onEvent = jest.fn();
    type Props = { granted: boolean };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ granted }) =>
        useGeofence(OUTSIDE, BOUNDARY, {
          permissionGranted: granted,
          onEvent,
        }),
      { initialProps: { granted: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(GRACE);
    });
    expect(result.current?.status).toBe("violating");
    expect(onEvent).toHaveBeenCalledTimes(1);

    await rerender({ granted: false });
    expect(result.current?.status).toBe("violating");
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("emits violation-cleared when returning inside after violating", async () => {
    const onEvent = jest.fn();
    type Props = { fix: GameLocationFix };
    const { result, rerender } = await renderHook<HookResult, Props>(
      ({ fix }) =>
        useGeofence(fix, BOUNDARY, { permissionGranted: true, onEvent }),
      { initialProps: { fix: OUTSIDE } },
    );

    await act(async () => {
      jest.advanceTimersByTime(GRACE);
    });
    expect(result.current?.status).toBe("violating");

    await rerender({ fix: { ...INSIDE, timestamp: 2_100_000 } });
    expect(result.current?.status).toBe("inside");
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "violation-cleared" }),
    );
  });
});
