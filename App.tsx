import Mapbox, {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  StyleURL,
  UserLocation,
  UserTrackingMode,
} from "@rnmapbox/maps";
import { bbox } from "@turf/turf";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  isNearTrueEdge,
  playableBoundaryFromTrue,
  squarePolygonFromCenter,
  STOCK_SQUARE_SIDE_M,
} from "./src/geofence";
import { useGameLocation } from "./src/hooks/useGameLocation";
import { useGeofence } from "./src/hooks/useGeofence";

/** Padding [top, right, bottom, left] so fitBounds clears banners/HUD. */
const PLACE_FIT_PADDING = [80, 48, 220, 48] as const;
const PLACE_FIT_DURATION_MS = 350;

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

const ARENA_SOURCE_ID = "arena-boundary";
const ARENA_FILL_ID = "arena-boundary-fill";
const ARENA_LINE_ID = "arena-boundary-line";
const PLAYABLE_SOURCE_ID = "arena-playable-boundary";
const PLAYABLE_LINE_ID = "arena-playable-boundary-line";
const ARENA_PIN_ID = "arena-center-pin";

const ARENA_FILL_STYLE = {
  fillColor: "#7cb7ff",
  fillOpacity: 0.15,
} as const;

const ARENA_LINE_STYLE = {
  lineColor: "#7cb7ff",
  lineWidth: 2,
  lineOpacity: 0.9,
} as const;

/** Dev-only outline of the +5 m playable shoulder (not shown in release). */
const PLAYABLE_LINE_STYLE = {
  lineColor: "#ffb14a",
  lineWidth: 2,
  lineOpacity: 0.85,
  lineDasharray: [2, 2] as number[],
};

/** Setup pick area → setup place arena → gameplay. Home comes later. */
type Phase = "setup-locate" | "setup-place" | "playing";

function asLngLat(pos: GeoJSON.Position | null | undefined): [number, number] | null {
  if (
    pos != null &&
    pos.length >= 2 &&
    typeof pos[0] === "number" &&
    typeof pos[1] === "number"
  ) {
    return [pos[0], pos[1]];
  }
  return null;
}

export default function App() {
  const [mapReady, setMapReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup-locate");
  const [arenaCenter, setArenaCenter] = useState<[number, number] | null>(
    null,
  );
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(
    null,
  );
  const mapCenterRef = useRef<[number, number] | null>(null);
  const cameraRef = useRef<Camera>(null);
  const arenaCenterRef = useRef(arenaCenter);
  arenaCenterRef.current = arenaCenter;

  const { permission, requestPermission, fix, error, stream } =
    useGameLocation(true);

  /** True arena — drawn on the map. */
  const trueBoundary = useMemo(
    () =>
      arenaCenter
        ? squarePolygonFromCenter(arenaCenter, STOCK_SQUARE_SIDE_M)
        : null,
    [arenaCenter],
  );

  /** Invisible +5 m shoulder — violation checks only. */
  const playableBoundary = useMemo(
    () => (trueBoundary ? playableBoundaryFromTrue(trueBoundary) : null),
    [trueBoundary],
  );

  const permissionGranted =
    permission === Location.PermissionStatus.GRANTED;

  // Geofence only during gameplay; feed playable (buffered) boundary.
  const { status: geofenceStatus } = useGeofence(
    fix,
    phase === "playing" ? playableBoundary : null,
    { permissionGranted },
  );

  const nearTrueEdge =
    phase === "playing" &&
    fix != null &&
    trueBoundary != null &&
    isNearTrueEdge([fix.longitude, fix.latitude], trueBoundary);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    Mapbox.setAccessToken(MAPBOX_TOKEN).catch(() => {});
  }, []);

  useEffect(() => {
    if (permission === null) return;
    if (permission !== Location.PermissionStatus.GRANTED)
      void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!fix || initialCenter != null) return;
    const center: [number, number] = [fix.longitude, fix.latitude];
    setInitialCenter(center);
    mapCenterRef.current = center;
  }, [fix, initialCenter]);

  // Fit the full stock square once when entering place (not on every tap move).
  useEffect(() => {
    if (phase !== "setup-place") return;
    const center = arenaCenterRef.current;
    if (!center) return;

    const poly = squarePolygonFromCenter(center, STOCK_SQUARE_SIDE_M);
    const [minLng, minLat, maxLng, maxLat] = bbox(poly);
    const timer = setTimeout(() => {
      cameraRef.current?.fitBounds(
        [maxLng, maxLat],
        [minLng, minLat],
        [...PLACE_FIT_PADDING],
        PLACE_FIT_DURATION_MS,
      );
    }, 50);
    return () => clearTimeout(timer);
  }, [phase]);

  const panLocked = phase === "setup-place";
  const showArena = phase === "setup-place" || phase === "playing";
  const showPlacePin = phase === "setup-place" && arenaCenter != null;

  const confirmLocation = () => {
    const center =
      mapCenterRef.current ??
      (fix ? ([fix.longitude, fix.latitude] as [number, number]) : null);
    if (!center) return;
    setArenaCenter(center);
    setPhase("setup-place");
  };

  const confirmArena = () => {
    if (!arenaCenter) return;
    setPhase("playing");
  };

  const backToLocate = () => {
    setArenaCenter(null);
    setPhase("setup-locate");
  };

  const hudLines = useMemo(() => {
    if (!fix) return "Waiting for GPS fix…";
    const acc =
      fix.accuracyM != null ? `${Math.round(fix.accuracyM)} m` : "—";
    return [
      `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`,
      `±${acc} · stream ${stream.distanceIntervalM} m / ${stream.timeIntervalMs / 1000} s`,
      `Arena ${STOCK_SQUARE_SIDE_M} m stock square`,
    ].join("\n");
  }, [fix, stream]);

  const phaseHint =
    phase === "setup-locate"
      ? "Pan the map, then confirm this area"
      : phase === "setup-place"
        ? "Tap to move · pinch to zoom · then confirm"
        : null;

  const geofenceLabel =
    geofenceStatus === "violating"
      ? "OUT OF BOUNDS"
      : geofenceStatus === "pending"
        ? "Leaving arena…"
        : nearTrueEdge
          ? "Near boundary"
          : "In bounds";

  if (Platform.OS === "web") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Drengr</Text>
        <Text style={styles.body}>
          Phase 1 targets iOS (dev build). Use{" "}
          <Text style={styles.mono}>npx expo run:ios</Text> after prebuild.
        </Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Mapbox token missing</Text>
        <Text style={styles.body}>
          Add{" "}
          <Text style={styles.mono}>EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN</Text> to{" "}
          <Text style={styles.mono}>.env</Text> (public pk. token), restart the
          bundler, then run a dev client build — @rnmapbox/maps is not in Expo
          Go.
        </Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (permission === Location.PermissionStatus.DENIED) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Location is off</Text>
        <Text style={styles.body}>
          Turn on location for Drengr in Settings to use the map.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => void Linking.openSettings()}
        >
          <Text style={styles.buttonLabel}>Open Settings</Text>
        </Pressable>
        <StatusBar style="light" />
      </View>
    );
  }

  if (permission !== Location.PermissionStatus.GRANTED) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Location needed</Text>
        <Text style={styles.body}>
          Allow location while using the app to show your position on the map.
        </Text>
        <ActivityIndicator color="#7cb7ff" style={{ marginTop: 16 }} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Avoid Mapbox default (0,0 — Atlantic) before the first GPS fix.
  if (initialCenter == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Finding your location…</Text>
        <Text style={styles.body}>
          Setup starts at your current position. Stay outdoors with a clear sky
          if this takes more than a few seconds.
        </Text>
        <ActivityIndicator color="#7cb7ff" style={{ marginTop: 16 }} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={StyleURL.Outdoors}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled
        attributionEnabled
        scrollEnabled={!panLocked}
        zoomEnabled
        pitchEnabled={!panLocked}
        rotateEnabled={!panLocked}
        gestureSettings={{
          panEnabled: !panLocked,
          pinchZoomEnabled: true,
          pinchPanEnabled: !panLocked,
          doubleTapToZoomInEnabled: true,
          doubleTouchToZoomOutEnabled: true,
          quickZoomEnabled: true,
        }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onCameraChanged={(state) => {
          const center = asLngLat(state.properties.center);
          if (center && phase === "setup-locate") {
            mapCenterRef.current = center;
          }
        }}
        onPress={(feature) => {
          if (phase !== "setup-place") return;
          const coords = asLngLat(feature.geometry.coordinates);
          if (coords) setArenaCenter(coords);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 17,
          }}
          followUserLocation={phase === "playing"}
          followUserMode={UserTrackingMode.FollowWithHeading}
          followZoomLevel={17}
          animationMode="moveTo"
        />
        <UserLocation
          visible
          showsUserHeadingIndicator
          minDisplacement={5}
          animated
        />
        {showArena && trueBoundary ? (
          <ShapeSource id={ARENA_SOURCE_ID} shape={trueBoundary}>
            <FillLayer id={ARENA_FILL_ID} style={ARENA_FILL_STYLE} />
            <LineLayer id={ARENA_LINE_ID} style={ARENA_LINE_STYLE} />
          </ShapeSource>
        ) : null}
        {__DEV__ && showArena && playableBoundary ? (
          <ShapeSource id={PLAYABLE_SOURCE_ID} shape={playableBoundary}>
            <LineLayer id={PLAYABLE_LINE_ID} style={PLAYABLE_LINE_STYLE} />
          </ShapeSource>
        ) : null}
        {showPlacePin ? (
          <PointAnnotation
            id={ARENA_PIN_ID}
            coordinate={arenaCenter}
            draggable={false}
            title="Arena"
          >
            {/* PointAnnotation allows max 1 subview (plus optional callout). */}
            <View style={styles.arenaPin} />
          </PointAnnotation>
        ) : null}
      </MapView>

      {!mapReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#7cb7ff" />
        </View>
      ) : null}

      {phase === "playing" ? (
        <View
          style={[
            styles.geofenceBanner,
            geofenceStatus === "violating" && styles.geofenceBannerViolating,
            geofenceStatus === "pending" && styles.geofenceBannerPending,
            geofenceStatus === "inside" &&
              nearTrueEdge &&
              styles.geofenceBannerNearEdge,
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.geofenceBannerText,
              geofenceStatus === "violating" &&
                styles.geofenceBannerTextViolating,
              geofenceStatus === "inside" &&
                nearTrueEdge &&
                styles.geofenceBannerTextNearEdge,
            ]}
          >
            {geofenceLabel}
          </Text>
        </View>
      ) : (
        <View style={styles.geofenceBanner} pointerEvents="none">
          <Text style={styles.geofenceBannerText}>{phaseHint}</Text>
        </View>
      )}

      <View style={styles.bottomChrome}>
        {phase === "setup-locate" ? (
          <Pressable
            style={styles.button}
            onPress={confirmLocation}
            disabled={initialCenter == null && fix == null}
          >
            <Text style={styles.buttonLabel}>Confirm area</Text>
          </Pressable>
        ) : null}
        {phase === "setup-place" ? (
          <View style={styles.actionRow}>
            <Pressable style={styles.buttonSecondary} onPress={backToLocate}>
              <Text style={styles.buttonLabel}>Back</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={confirmArena}>
              <Text style={styles.buttonLabel}>Confirm arena</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.hud} pointerEvents="none">
          <Text style={styles.hudTitle}>GPS (expo-location stream)</Text>
          <Text style={styles.hudBody}>{hudLines}</Text>
          {error ? <Text style={styles.hudError}>{error}</Text> : null}
        </View>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  centered: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    color: "#e8eef7",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    color: "#9aacbf",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: "#c8d9e8",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,15,20,0.35)",
  },
  geofenceBanner: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(11,15,20,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,183,255,0.45)",
    alignItems: "center",
  },
  geofenceBannerPending: {
    borderColor: "rgba(255,200,100,0.7)",
    backgroundColor: "rgba(40,30,10,0.9)",
  },
  geofenceBannerNearEdge: {
    borderColor: "rgba(255,180,80,0.75)",
    backgroundColor: "rgba(45,32,12,0.9)",
  },
  geofenceBannerViolating: {
    borderColor: "rgba(255,100,90,0.85)",
    backgroundColor: "rgba(50,12,12,0.92)",
  },
  geofenceBannerText: {
    color: "#9fd0ff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  geofenceBannerTextNearEdge: {
    color: "#ffd09a",
  },
  geofenceBannerTextViolating: {
    color: "#ffb4ac",
  },
  arenaPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7cb7ff",
    borderWidth: 2,
    borderColor: "#e8eef7",
  },
  bottomChrome: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 36,
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  hud: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(11,15,20,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hudTitle: {
    color: "#8fa6bc",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  hudBody: {
    color: "#e8eef7",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  hudError: { color: "#ff8a7a", marginTop: 8, fontSize: 12 },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(124,183,255,0.2)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,183,255,0.45)",
    alignItems: "center",
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
  },
  buttonLabel: { color: "#e8eef7", fontSize: 16, fontWeight: "600" },
});
