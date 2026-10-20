/** biome-ignore-all lint/suspicious/noShadowRestrictedNames: <forced> */
import { Cancel01Icon, FullScreenIcon, Gps01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Camera,
  type CameraRef,
  Map,
  Marker,
  type StyleSpecification,
  TransformRequestManager,
} from "@maplibre/maplibre-react-native";
import { Image } from "expo-image";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Text } from "@/components/modules/typography";
import type { Point } from "@/lib/api/attendance";
import { type Coordinates, distanceInMetres } from "@/lib/maps/geo";
import { loadOlaMapStyle, OLA_MAPS_API_BASE, olaMapsKey } from "@/lib/maps/ola-maps";

type Props = {
  checkIn: Point | null;
  checkOut: Point | null;
  organization: Coordinates | null;
  live: Coordinates | null;
  /** Inline height; the home screen sizes the map to what the rest of the page leaves. */
  height: number;
};

type MapPoint = Coordinates & { kind: "start" | "transit" | "destination" | "organization" };

const pins: Record<MapPoint["kind"], number> = {
  destination: require("@/assets/map-pin/destination.webp"),
  organization: require("@/assets/map-pin/fallback.webp"),
  start: require("@/assets/map-pin/start.webp"),
  transit: require("@/assets/map-pin/transit.webp"),
};
// The pin artwork is 90×110 with its tip at the bottom centre.
const PIN_SIZE = { height: 44, width: 36 };
const LEGEND_PIN_SIZE = { height: 13, width: 11 };

const pinLabels: Record<MapPoint["kind"], string> = {
  destination: "Check-out",
  organization: "Office",
  start: "You are here",
  transit: "Check-in",
};

/** Compact key in the bottom-left corner: what each pin currently on the map means. */
function MapLegend({ points, bottom }: { points: MapPoint[]; bottom: number }) {
  if (!points.length) return null;
  return (
    <View
      className="absolute left-3 flex-row items-center gap-3 bg-white/95 px-2 py-1.5"
      pointerEvents="none"
      style={{ bottom, elevation: 3 }}
    >
      {points.map((point) => (
        <View className="flex-row items-center gap-1" key={point.kind}>
          <Image contentFit="contain" source={pins[point.kind]} style={LEGEND_PIN_SIZE} />
          <Text className="text-[11px] text-foreground">{pinLabels[point.kind]}</Text>
        </View>
      ))}
    </View>
  );
}

const olaMapsApiKey = olaMapsKey();

// Configure this before the first Map renders.  The style URL is authenticated itself,
// but its sprite, glyph and tile URLs are separate native requests.
if (olaMapsApiKey) {
  TransformRequestManager.addUrlSearchParam({
    id: "ola-maps-api-key",
    match: OLA_MAPS_API_BASE,
    name: "api_key",
    value: olaMapsApiKey,
  });
}

// Pins closer than this are one place (e.g. checked in and out at the desk). They are nudged
// apart just enough to overlap slightly, tips still on the spot, so both stay visible.
// (Android map markers ignore transforms, so the pins can't be tilted instead.)
const SAME_PLACE_METRES = 30;
const SAME_PLACE_SHIFT = 10;
// Tapping a pin zooms in this close to it; "Recenter map" returns to the overview.
const PIN_FOCUS_ZOOM = 17;

/** Horizontal pixel offset per pin; a pin alone at its place stays centred. */
function samePlaceOffsets(points: MapPoint[]) {
  const groups: MapPoint[][] = [];
  for (const point of points) {
    const group = groups.find((members) => distanceInMetres(members[0], point) < SAME_PLACE_METRES);
    if (group) group.push(point);
    else groups.push([point]);
  }
  const offsets = {} as Record<MapPoint["kind"], [number, number]>;
  for (const group of groups) {
    group.forEach((point, index) => {
      offsets[point.kind] = [(index * 2 - (group.length - 1)) * SAME_PLACE_SHIFT, 0];
    });
  }
  return offsets;
}

function boundsFor(points: MapPoint[]): [number, number, number, number] | null {
  if (points.length < 2) return null;
  return points.reduce<[number, number, number, number]>(
    ([west, south, east, north], point) => [
      Math.min(west, point.longitude),
      Math.min(south, point.latitude),
      Math.max(east, point.longitude),
      Math.max(north, point.latitude),
    ],
    [points[0].longitude, points[0].latitude, points[0].longitude, points[0].latitude],
  );
}

function useOlaMapStyle() {
  const [style, setStyle] = useState<StyleSpecification | string | null>(null);
  useEffect(() => {
    if (!olaMapsApiKey) return;
    let active = true;
    void loadOlaMapStyle().then((next) => {
      if (active) setStyle(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return style;
}

function MapControl({
  icon,
  label,
  onPress,
}: {
  icon: typeof Gps01Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full bg-white"
      onPress={onPress}
      style={{ elevation: 3 }}
    >
      <HugeiconsIcon icon={icon} size={22} />
    </Pressable>
  );
}

interface NativeOlaMapProps {
  points: MapPoint[];
  /** Distance of the control row from the top edge. */
  controlsTop: number;
  /** Distance of the pin legend from the bottom edge. */
  legendBottom: number;
  /** The control placed before "recenter" (maximize, or close when full screen). */
  children: ReactNode;
}

function NativeOlaMap({ points, controlsTop, legendBottom, children }: NativeOlaMapProps) {
  const camera = useRef<CameraRef>(null);
  const style = useOlaMapStyle();
  const bounds = useMemo(() => boundsFor(points), [points]);
  const offsets = useMemo(() => samePlaceOffsets(points), [points]);
  const center = points[0] ?? { latitude: 22.9734, longitude: 78.6569 };

  /** Frames every pin (or the single pin at street zoom), undoing any drag or zoom. */
  const fitCamera = useCallback(
    (duration = 0) => {
      if (bounds) {
        camera.current?.fitBounds(bounds, {
          duration,
          padding: { bottom: 56, left: 56, right: 56, top: 56 },
        });
      } else {
        camera.current?.easeTo({
          center: [center.longitude, center.latitude],
          duration,
          zoom: 15,
        });
      }
    },
    [bounds, center.latitude, center.longitude],
  );

  useEffect(() => fitCamera(), [fitCamera]);

  return (
    <View className="flex-1">
      {olaMapsApiKey && style ? (
        <Map
          attribution={false}
          compass={false}
          // Set explicitly: only then does the Android map view stop the page's ScrollView and
          // pull-to-refresh from taking over a drag that starts on the map.
          doubleTapZoom
          dragPan
          logo={false}
          mapStyle={style}
          onDidFinishLoadingStyle={() => fitCamera()}
          preferredFramesPerSecond={60}
          style={{ flex: 1 }}
          touchPitch={false}
          touchRotate={false}
          touchZoom
        >
          <Camera
            initialViewState={{
              center: [center.longitude, center.latitude],
              zoom: points.length > 1 ? 13 : 15,
            }}
            ref={camera}
          />
          {points.map((point) => (
            <Marker
              anchor="bottom"
              id={point.kind}
              key={point.kind}
              lngLat={[point.longitude, point.latitude]}
              offset={offsets[point.kind]}
              onPress={() =>
                camera.current?.easeTo({
                  center: [point.longitude, point.latitude],
                  duration: 500,
                  zoom: PIN_FOCUS_ZOOM,
                })
              }
            >
              <Image contentFit="contain" source={pins[point.kind]} style={PIN_SIZE} />
            </Marker>
          ))}
        </Map>
      ) : null}
      <MapLegend bottom={legendBottom} points={points} />
      <View className="absolute left-4 flex-row gap-3" style={{ top: controlsTop }}>
        {children}
        <MapControl icon={Gps01Icon} label="Recenter map" onPress={() => fitCamera(500)} />
      </View>
    </View>
  );
}

export function HomeMap({ checkIn, checkOut, height, live, organization }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Organisation: always. Before checking in: where the user is now. After: the check-in
  // point replaces the live position, and a check-out adds the destination pin.
  const points = useMemo<MapPoint[]>(
    () =>
      [
        organization ? { ...organization, kind: "organization" } : null,
        checkIn ? { ...checkIn, kind: "transit" } : live ? { ...live, kind: "start" } : null,
        checkOut ? { ...checkOut, kind: "destination" } : null,
      ].filter((point): point is MapPoint => Boolean(point)),
    [checkIn, checkOut, live, organization],
  );
  return (
    <>
      <View
        className="border border-border overflow-hidden rounded-2xl bg-accent"
        style={{ height }}
      >
        <NativeOlaMap controlsTop={16} legendBottom={12} points={points}>
          <MapControl
            icon={FullScreenIcon}
            label="Maximize map"
            onPress={() => setExpanded(true)}
          />
        </NativeOlaMap>
      </View>
      <Modal animationType="fade" onRequestClose={() => setExpanded(false)} visible={expanded}>
        <View className="flex-1 bg-accent">
          <NativeOlaMap controlsTop={56} legendBottom={40} points={points}>
            <MapControl
              icon={Cancel01Icon}
              label="Minimize map"
              onPress={() => setExpanded(false)}
            />
          </NativeOlaMap>
        </View>
      </Modal>
    </>
  );
}
