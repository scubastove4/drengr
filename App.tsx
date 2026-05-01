import Mapbox, {
  Camera,
  MapView,
  StyleURL,
  UserLocation,
  UserTrackingMode,
} from "@rnmapbox/maps";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useGameLocation } from "./src/hooks/useGameLocation";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

export default function App() {
  const [mapReady, setMapReady] = useState(false);
  const { permission, requestPermission, fix, error, stream } =
    useGameLocation(true);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    Mapbox.setAccessToken(MAPBOX_TOKEN).catch(() => {});
  }, []);

  useEffect(() => {
    if (permission === null) return;
    if (permission !== Location.PermissionStatus.GRANTED)
      void requestPermission();
  }, [permission, requestPermission]);

  const hudLines = useMemo(() => {
    if (!fix) return "Waiting for GPS fix…";
    const acc =
      fix.accuracyM != null ? `${Math.round(fix.accuracyM)} m` : "—";
    return [
      `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`,
      `±${acc} · stream ${stream.distanceIntervalM} m / ${stream.timeIntervalMs / 1000} s`,
    ].join("\n");
  }, [fix, stream]);

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

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={StyleURL.Outdoors}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled
        attributionEnabled
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera
          followUserLocation
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
      </MapView>

      {!mapReady ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#7cb7ff" />
        </View>
      ) : null}

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTitle}>GPS (expo-location stream)</Text>
        <Text style={styles.hudBody}>{hudLines}</Text>
        {error ? <Text style={styles.hudError}>{error}</Text> : null}
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
  hud: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 36,
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
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(124,183,255,0.2)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,183,255,0.45)",
  },
  buttonLabel: { color: "#e8eef7", fontSize: 16, fontWeight: "600" },
});
