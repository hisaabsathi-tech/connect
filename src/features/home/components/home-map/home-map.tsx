/** biome-ignore-all lint/suspicious/noShadowRestrictedNames: <forced> */
import {
  Call02Icon,
  Cancel01Icon,
  FullScreenIcon,
  Gps01Icon,
  MapsLocation01Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  LogManager,
  Map,
  Marker,
  type StyleSpecification,
  TransformRequestManager,
} from "@maplibre/maplibre-react-native";
import { Image } from "expo-image";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { Point } from "@/lib/api/attendance";
import { fetchRoute, type RoadRoute } from "@/lib/api/maps";
import { useAuthSession } from "@/lib/auth/session";
import { type Coordinates, distanceInMetres } from "@/lib/maps/geo";
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from "@/lib/maps/google-maps";
import {
  loadOlaMapStyle,
  OLA_MAPS_API_BASE,
  olaMapsKey,
  reverseGeocodeAddress,
} from "@/lib/maps/ola-maps";
import { dialUrl, formatMobile } from "@/lib/phone";
import { useTrackingStatus } from "@/lib/tracking/status";

/** An order still to deliver; `exact` when its street address was found, else its area. */
export type OrderPoint = Coordinates & {
  orderId: string;
  awbNo: string;
  receiver: string | null;
  /** The receiver's mobile, to call from the map. */
  mobile: string | null;
  /** The order's address as given (street, area, pincode). */
  address: string;
  exact: boolean;
};

type Props = {
  checkIn: Point | null;
  checkOut: Point | null;
  organization: Coordinates | null;
  live: Coordinates | null;
  /**
   * A delivery boy shows as the rider wherever they are; their map has no office pin and no
   * legend, only themselves and their deliveries (or the day's check-in and check-out).
   */
  deliveryBoy?: boolean;
  /**
   * A delivery boy's orders still to deliver, when they have any: the map then shows where they
   * are and where the orders go, instead of the day's check-in and check-out.
   */
  orders?: OrderPoint[] | null;
  /** Inline height; the home screen sizes the map to what the rest of the page leaves. */
  height: number;
  /** Eases height changes in; off while the page is still settling behind its skeleton. */
  animateHeight?: boolean;
  /** Changes when the page reloads: the map drops a tapped pin and recenters. */
  resetKey?: number;
  /**
   * A live delivery trip to follow instead of the day's pins: the truck, every order on the sheet
   * and the predicted road through them, as on the trip's own map, which the corner button opens.
   */
  liveTrip?: {
    path: Coordinates[];
    stops: TripStop[];
    vehicle: Coordinates | null;
    onExpand: () => void;
  } | null;
};

type PinKind =
  | "delivered-at"
  | "start"
  | "transit"
  | "destination"
  | "organization"
  | "rider"
  | "order"
  | "order-area"
  | "truck";

type MapPoint = Coordinates & {
  id: string;
  kind: PinKind;
  /** Degrees clockwise from north the pin is turned to (the live trip's truck). */
  bearing?: number;
  /** An order's pin: tapping it opens the map full screen with this card along the bottom. */
  detail?: {
    title: string;
    address: string;
    exact: boolean;
    receiver: string | null;
    mobile: string | null;
  };
  /** A place's pin (where an order was delivered): tapping it shows this card along the bottom. */
  info?: { title: string; address: string | null };
};

const pins: Record<PinKind, number> = {
  "delivered-at": require("@/assets/map-pin/fallback.webp"),
  destination: require("@/assets/map-pin/destination.webp"),
  order: require("@/assets/map-pin/destination.webp"),
  "order-area": require("@/assets/map-pin/transit.webp"),
  organization: require("@/assets/map-pin/fallback.webp"),
  rider: require("@/assets/map-pin/delivery-pin.webp"),
  start: require("@/assets/map-pin/start.webp"),
  transit: require("@/assets/map-pin/transit.webp"),
  truck: require("@/assets/map-pin/truck.webp"),
};
// The pin artwork is 90×110 with its tip at the bottom centre.
const PIN_SIZE = { height: 44, width: 36 };
const LEGEND_PIN_SIZE = { height: 13, width: 11 };
// The rider (410×614, seen from above) sits centred on the spot rather than pointing at it.
const RIDER_SIZE = { height: 48, width: 32 };
// The truck (140×342, seen from above, facing up) is turned to the way it is driving.
const TRUCK_SIZE = { height: 50, width: 20 };
const centred = (kind: PinKind) => kind === "rider" || kind === "truck";

// The user's own position needs no key; every other pin is named in the legend.
const pinLabels: Partial<Record<PinKind, string>> = {
  "delivered-at": "Delivered Location",
  destination: "Check-out",
  order: "Order Delivery Location",
  "order-area": "Approx. area",
  organization: "Office",
  transit: "Check-in",
};

/** Compact key in the bottom-left corner: what each kind of pin currently on the map means. */
function MapLegend({ points, bottom }: { points: MapPoint[]; bottom: number }) {
  const kinds = [...new Set(points.map((point) => point.kind))].filter((kind) => pinLabels[kind]);
  if (!kinds.length) return null;
  return (
    <View
      // One row; a narrow map wraps it rather than cutting a label off.
      className="absolute left-3 flex-row flex-wrap items-center gap-x-3 gap-y-1 bg-white/95 px-2 py-1.5"
      pointerEvents="none"
      style={{ bottom, elevation: 3, maxWidth: "92%" }}
    >
      {kinds.map((kind) => (
        <View className="flex-row items-center gap-1" key={kind}>
          <Image contentFit="contain" source={pins[kind]} style={LEGEND_PIN_SIZE} />
          <Text className="text-[11px] text-foreground">{pinLabels[kind]}</Text>
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

// A camera command that races the map mounting or unmounting (e.g. the pins change right as the
// map appears) finds no native view: the command just doesn't apply. Native logs that as an error
// on top of the rejected promise, so drop those log lines; real map errors still show.
LogManager.onLog(({ tag }) => tag === "ReactTagResolver");

/**
 * Runs a camera command, ignoring the rejection it gets when the map isn't there (see above).
 * The commands are typed `void` but return the native call's promise.
 */
function moveCamera(command: unknown) {
  void Promise.resolve(command).catch(() => undefined);
}

// Pins closer than this are one place (e.g. checked in and out at the desk). They are nudged
// apart just enough to overlap slightly, tips still on the spot, so both stay visible.
// (Android map markers ignore transforms, so the pins can't be tilted instead.)
const SAME_PLACE_METRES = 30;
const SAME_PLACE_SHIFT = 10;
// Tapping a pin zooms in this close to it; "Recenter map" returns to the overview.
const PIN_FOCUS_ZOOM = 17;
// A map anchored on the user (a delivery boy with no orders) shows their streets at this zoom.
const ANCHOR_ZOOM = 16;

/** Horizontal pixel offset per pin; a pin alone at its place stays centred. */
function samePlaceOffsets(points: MapPoint[]) {
  const groups: MapPoint[][] = [];
  for (const point of points) {
    const group = groups.find((members) => distanceInMetres(members[0], point) < SAME_PLACE_METRES);
    if (group) group.push(point);
    else groups.push([point]);
  }
  const offsets: Record<string, [number, number]> = {};
  for (const group of groups) {
    group.forEach((point, index) => {
      offsets[point.id] = [(index * 2 - (group.length - 1)) * SAME_PLACE_SHIFT, 0];
    });
  }
  return offsets;
}

// Room kept between the framed pins and the map's edges (pins are drawn above their point).
const PIN_ROOM = 56;
// The kept room never takes more than this share of the map's height (or width), so the pins
// always have space left to fit in.
const MAX_PADDING_SHARE = 0.7;

/**
 * The room to keep around framed pins, scaled down evenly when it wouldn't leave the pins enough
 * of the map (a small map with a card open).
 */
function fitPadding(
  size: { height: number; width: number },
  wanted: { bottom: number; side: number; top: number },
) {
  const vertical = wanted.top + wanted.bottom;
  const verticalScale =
    size.height && vertical > size.height * MAX_PADDING_SHARE
      ? (size.height * MAX_PADDING_SHARE) / vertical
      : 1;
  const horizontalScale =
    size.width && wanted.side * 2 > size.width * MAX_PADDING_SHARE
      ? (size.width * MAX_PADDING_SHARE) / (wanted.side * 2)
      : 1;
  return {
    bottom: Math.round(wanted.bottom * verticalScale),
    left: Math.round(wanted.side * horizontalScale),
    right: Math.round(wanted.side * horizontalScale),
    top: Math.round(wanted.top * verticalScale),
  };
}

// Pins all within this many degrees of each other (a few metres) are framed as one place.
const SAME_SPOT_DEGREES = 0.0002;

function boundsFor(points: Coordinates[]): [number, number, number, number] | null {
  if (points.length < 2) return null;
  const bounds = points.reduce<[number, number, number, number]>(
    ([west, south, east, north], point) => [
      Math.min(west, point.longitude),
      Math.min(south, point.latitude),
      Math.max(east, point.longitude),
      Math.max(north, point.latitude),
    ],
    [points[0].longitude, points[0].latitude, points[0].longitude, points[0].latitude],
  );
  // Fitting a box with no size zooms in all the way; one place gets the street zoom instead.
  const [west, south, east, north] = bounds;
  return east - west < SAME_SPOT_DEGREES && north - south < SAME_SPOT_DEGREES ? null : bounds;
}

function ExternalMapButton({
  icon,
  label,
  url,
}: {
  icon: typeof Route01Icon;
  label: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      className="h-10 flex-1 flex-row items-center justify-center gap-2 border border-primary active:bg-accent"
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
    >
      <Text className="text-sm font-medium text-primary">{label}</Text>
      <HugeiconsIcon color={colors.primary} icon={icon} size={18} strokeWidth={1.8} />
    </Pressable>
  );
}

/**
 * Who receives the order, on its own row: their name and mobile, with a call button that opens
 * the phone's dialer on the number (unless `callable` is off). Nothing when the order has neither.
 */
function Receiver({
  callable,
  mobile,
  name,
}: {
  callable: boolean;
  mobile: string | null;
  name: string | null;
}) {
  if (!(name || mobile)) return null;
  const dial = callable ? dialUrl(mobile) : null;
  return (
    <View className="mt-1.5 flex-row items-center gap-3">
      <View className="flex-1">
        {name ? (
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {name}
          </Text>
        ) : null}
        {mobile ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {formatMobile(mobile)}
          </Text>
        ) : null}
      </View>
      {dial ? (
        <Pressable
          accessibilityLabel={`Call ${name ?? formatMobile(mobile ?? "")}`}
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center bg-[#CDD4FF] active:opacity-80"
          onPress={() => void Linking.openURL(dial).catch(() => undefined)}
        >
          <HugeiconsIcon color={colors.primary} icon={Call02Icon} size={18} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The tapped order's address along the bottom of the map, with View Location (the place in
 * Google Maps) and Directions (from where the user is) links. An exact pin goes by its coordinates;
 * one placed only in the area lets Google Maps find the written address itself.
 */
/**
 * A place's card along the bottom of the map (where an order was handed over): its full address,
 * as saved with it or, for an older record without one, looked up from the point, with View
 * Location and Directions for the spot.
 */
function PlaceCard({
  bottom,
  onClose,
  onHeight,
  origin,
  point,
}: {
  bottom: number;
  onClose: () => void;
  onHeight: (height: number) => void;
  /** Where the user is, for directions. */
  origin: Coordinates | null;
  point: MapPoint & { info: NonNullable<MapPoint["info"]> };
}) {
  const saved = point.info.address;
  const [found, setFound] = useState<string | null>(null);
  const [looking, setLooking] = useState(!saved);
  const { latitude, longitude } = point;
  useEffect(() => {
    if (saved) return;
    let current = true;
    setLooking(true);
    void reverseGeocodeAddress({ latitude, longitude }).then((address) => {
      if (!current) return;
      setFound(address);
      setLooking(false);
    });
    return () => {
      current = false;
    };
  }, [latitude, longitude, saved]);
  const address = saved ?? found;
  const spot = { latitude, longitude };
  return (
    <View
      className="absolute right-3 left-3 bg-white pt-3 pr-2 pb-3 pl-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={{ bottom, elevation: 4 }}
    >
      <View className="flex-row items-start gap-3">
        <Image contentFit="contain" source={pins[point.kind]} style={{ height: 24, width: 20 }} />
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
            {point.info.title}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-foreground" selectable>
            {address ??
              (looking
                ? "Finding the address…"
                : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close the address"
          accessibilityRole="button"
          className="h-8 w-8 items-center justify-center"
          hitSlop={6}
          onPress={onClose}
        >
          <HugeiconsIcon color={colors.mutedForeground} icon={Cancel01Icon} size={16} />
        </Pressable>
      </View>
      {/* The spot itself, by its coordinates (the same buttons as an order's card). */}
      <View className="mt-3 flex-row gap-2 pr-1">
        <ExternalMapButton
          icon={MapsLocation01Icon}
          label="View Location"
          url={googleMapsPlaceUrl({ address: address ?? "", point: spot })}
        />
        <ExternalMapButton
          icon={Route01Icon}
          label="Directions"
          url={googleMapsDirectionsUrl({ address: address ?? "", destination: spot, origin })}
        />
      </View>
    </View>
  );
}

function PinDetail({
  bottom,
  callable,
  onClose,
  onHeight,
  origin,
  point,
  trip,
}: {
  bottom: number;
  /** The receiver row's call button; off where the page already has one. */
  callable: boolean;
  onClose: () => void;
  onHeight: (height: number) => void;
  origin: Coordinates | null;
  point: MapPoint & { detail: NonNullable<MapPoint["detail"]> };
  /** The road distance and drive time from the user, when a route is drawn. */
  trip: string | null;
}) {
  const { address, exact } = point.detail;
  const destination = exact ? point : null;
  return (
    <View
      className="absolute right-3 left-3 bg-white pt-2.5 pr-2 pb-3 pl-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={{ bottom, elevation: 4 }}
    >
      <View className="flex-row items-start gap-3">
        <Image contentFit="contain" source={pins[point.kind]} style={{ height: 24, width: 20 }} />
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-[0.3px] text-muted-foreground">
            {point.kind === "order" ? "Order Delivery Location" : "Approx. delivery area"}
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-foreground" numberOfLines={1}>
            {point.detail.title}
            {trip ? <Text className="font-normal text-primary"> · {trip}</Text> : null}
          </Text>
          <Receiver callable={callable} mobile={point.detail.mobile} name={point.detail.receiver} />
          <Text className="mt-1 text-xs leading-4 text-muted-foreground" numberOfLines={3}>
            {point.detail.address}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close the address"
          accessibilityRole="button"
          className="h-8 w-8 items-center justify-center"
          hitSlop={6}
          onPress={onClose}
        >
          <HugeiconsIcon color={colors.mutedForeground} icon={Cancel01Icon} size={16} />
        </Pressable>
      </View>
      <View className="mt-3 flex-row gap-2 pr-1">
        <ExternalMapButton
          icon={MapsLocation01Icon}
          label="View Location"
          url={googleMapsPlaceUrl({ address, point: destination })}
        />
        <ExternalMapButton
          icon={Route01Icon}
          label="Directions"
          url={googleMapsDirectionsUrl({ address, destination, origin })}
        />
      </View>
    </View>
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
  /** The tapped pin: the camera stays on it and an order's card shows. */
  focusId: string | null;
  onFocus: (point: MapPoint | null) => void;
  /** Where the user is, for directions. */
  origin: Coordinates | null;
  showLegend: boolean;
  /** The pin the overview centres on (zoomed in) instead of framing every pin. */
  anchorId: string | null;
  /** Changes when the page reloads; the overview is shown again. */
  resetKey: number;
  /** A road path (`[longitude, latitude]` pairs) drawn under the pins and framed with them. */
  route?: [number, number][] | null;
  /** Where the vehicle has already driven, drawn fainter under the route. */
  trail?: [number, number][] | null;
  /** Shown on an order's card: the route's distance and drive time. */
  trip?: string | null;
  /**
   * False: a focused pin only opens its card and the camera keeps the overview (framed above
   * the card), as on an order's own map. True (Home): the camera zooms in on it.
   */
  zoomOnFocus?: boolean;
  /** An order card's call button (off on an order's own map, whose page has one). */
  callable?: boolean;
  /** Distance of the control row from the top edge. */
  controlsTop: number;
  /** Distance of the pin legend from the bottom edge. */
  legendBottom: number;
  /** The control placed before "recenter" (maximize, or close when full screen). */
  children: ReactNode;
}

function NativeOlaMap({
  anchorId,
  children,
  controlsTop,
  focusId,
  legendBottom,
  onFocus,
  origin,
  points,
  resetKey,
  route = null,
  trail = null,
  showLegend,
  trip = null,
  zoomOnFocus = true,
  callable = true,
}: NativeOlaMapProps) {
  const camera = useRef<CameraRef>(null);
  // Camera commands only apply once the map has loaded; earlier ones find no native view.
  const loaded = useRef(false);
  const style = useOlaMapStyle();
  const bounds = useMemo(
    () =>
      boundsFor([
        ...points,
        ...(route ?? []).map(([longitude, latitude]) => ({ latitude, longitude })),
      ]),
    [points, route],
  );
  const offsets = useMemo(() => samePlaceOffsets(points), [points]);
  const anchor = points.find((point) => point.id === anchorId) ?? null;
  const anchored = anchor !== null;
  const center = anchor ?? points[0] ?? { latitude: 22.9734, longitude: 78.6569 };
  // While a pin is focused, a moving live position doesn't reframe the map away from it.
  const focus = points.find((point) => point.id === focusId) ?? null;
  // The pin the camera keeps to; none when focusing only opens the card.
  const focusRef = useRef(focus);
  focusRef.current = zoomOnFocus ? focus : null;
  // An open card covers the bottom of the map; an overview framed behind it leaves it room.
  const [cardHeight, setCardHeight] = useState(0);
  const cardRoom = !zoomOnFocus && (focus?.detail || focus?.info) ? cardHeight + legendBottom : 0;
  // The map's own size: the room kept around the pins is capped to it, or a small map (the
  // update page's) with its card open would have no space left and the fit would miss the pins.
  const [size, setSize] = useState({ height: 0, width: 0 });
  const padding = useMemo(
    () =>
      fitPadding(size, {
        bottom: PIN_ROOM + cardRoom,
        side: PIN_ROOM,
        top: PIN_ROOM + controlsTop,
      }),
    [cardRoom, controlsTop, size],
  );

  /**
   * The overview, undoing any drag or zoom: zoomed in on the anchor when there is one, else
   * every pin framed (or the single pin at street zoom).
   */
  const fitCamera = useCallback(
    (duration = 0) => {
      if (!loaded.current) return;
      moveCamera(
        bounds && !anchored
          ? camera.current?.fitBounds(bounds, {
              duration,
              padding,
            })
          : camera.current?.easeTo({
              center: [center.longitude, center.latitude],
              duration,
              zoom: anchored ? ANCHOR_ZOOM : 15,
            }),
      );
    },
    [anchored, bounds, center.latitude, center.longitude, padding],
  );

  /** Zooms in on the focused pin. */
  const showFocus = useCallback((duration: number) => {
    const point = focusRef.current;
    if (!(loaded.current && point)) return;
    moveCamera(
      camera.current?.easeTo({
        center: [point.longitude, point.latitude],
        duration,
        zoom: PIN_FOCUS_ZOOM,
      }),
    );
  }, []);

  // A new focus zooms to it, and clearing it (the card's close, Recenter) eases back to the
  // overview. Otherwise the overview reframes as the pins change (a moving live position), but
  // never away from a focused pin.
  const shownFocusId = useRef(focusId);
  useEffect(() => {
    const changed = shownFocusId.current !== focusId;
    shownFocusId.current = focusId;
    if (focusRef.current) {
      if (changed) showFocus(500);
      return;
    }
    // Other reframes (the user moving, a card's height, a new route) ease too, never snap.
    fitCamera(changed ? 500 : 300);
  }, [fitCamera, focusId, showFocus]);

  // A page reload shows the overview again (the page has already cleared any focus).
  const shownResetKey = useRef(resetKey);
  useEffect(() => {
    if (shownResetKey.current === resetKey) return;
    shownResetKey.current = resetKey;
    if (!focusRef.current) fitCamera(500);
  }, [fitCamera, resetKey]);

  // Clearing a zoomed-in focus reframes through the effect; otherwise reframe here (a card
  // that doesn't zoom stays open).
  const recenter = () => {
    if (focusRef.current) onFocus(null);
    else fitCamera(500);
  };
  useEffect(
    () => () => {
      loaded.current = false;
    },
    [],
  );

  return (
    <View
      className="flex-1"
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setSize((previous) =>
          previous.height === height && previous.width === width ? previous : { height, width },
        );
      }}
    >
      {olaMapsApiKey && style ? (
        <Map
          // A TextureView draws inside the normal view tree. The default GLSurfaceView sits in
          // its own window layer, so it showed through screens sliding in over it (the scanner).
          androidView="texture"
          attribution={false}
          compass={false}
          // Set explicitly: only then does the Android map view stop the page's ScrollView and
          // pull-to-refresh from taking over a drag that starts on the map.
          doubleTapZoom
          dragPan
          logo={false}
          mapStyle={style}
          onDidFinishLoadingStyle={() => {
            loaded.current = true;
            if (focusRef.current) showFocus(0);
            else fitCamera();
          }}
          preferredFramesPerSecond={60}
          style={{ flex: 1 }}
          touchPitch={false}
          touchRotate={false}
          touchZoom
        >
          <Camera
            initialViewState={
              focus && zoomOnFocus
                ? { center: [focus.longitude, focus.latitude], zoom: PIN_FOCUS_ZOOM }
                : {
                    center: [center.longitude, center.latitude],
                    zoom: anchored ? ANCHOR_ZOOM : points.length > 1 ? 13 : 15,
                  }
            }
            ref={camera}
          />
          {trail && trail.length > 1 ? (
            <GeoJSONSource
              data={{
                geometry: { coordinates: trail, type: "LineString" },
                properties: {},
                type: "Feature",
              }}
              id="trail"
            >
              <Layer
                id="trail-line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": colors.primary, "line-opacity": 0.4, "line-width": 4 }}
                type="line"
              />
            </GeoJSONSource>
          ) : null}
          {route ? (
            <GeoJSONSource
              data={{
                geometry: { coordinates: route, type: "LineString" },
                properties: {},
                type: "Feature",
              }}
              id="route"
            >
              {/* A white casing under the brand-blue line keeps it clear over busy streets. */}
              <Layer
                id="route-casing"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#FFFFFF", "line-width": 9 }}
                type="line"
              />
              <Layer
                id="route-line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": colors.primary, "line-width": 5 }}
                type="line"
              />
            </GeoJSONSource>
          ) : null}
          {points.map((point) => (
            <Marker
              anchor={centred(point.kind) ? "center" : "bottom"}
              id={point.id}
              key={point.id}
              lngLat={[point.longitude, point.latitude]}
              offset={offsets[point.id]}
              onPress={() => {
                // Tapped again: the effect won't see a change, so zoom back in here.
                if (point.id === focusId && zoomOnFocus) showFocus(500);
                onFocus(point);
              }}
            >
              <Image
                contentFit="contain"
                source={pins[point.kind]}
                style={[
                  point.kind === "truck"
                    ? TRUCK_SIZE
                    : point.kind === "rider"
                      ? RIDER_SIZE
                      : PIN_SIZE,
                  point.bearing != null ? { transform: [{ rotate: `${point.bearing}deg` }] } : null,
                ]}
              />
            </Marker>
          ))}
        </Map>
      ) : null}
      {/* An order's (or a place's) card takes the legend's place while it is open. */}
      {focus?.detail ? (
        <PinDetail
          bottom={legendBottom}
          onClose={() => onFocus(null)}
          onHeight={setCardHeight}
          origin={origin}
          point={{ ...focus, detail: focus.detail }}
          callable={callable}
          trip={trip}
        />
      ) : focus?.info ? (
        <PlaceCard
          bottom={legendBottom}
          onClose={() => onFocus(null)}
          onHeight={setCardHeight}
          origin={origin}
          point={{ ...focus, info: focus.info }}
        />
      ) : showLegend ? (
        <MapLegend bottom={legendBottom} points={points} />
      ) : null}
      <View className="absolute left-4 flex-row gap-3" style={{ top: controlsTop }}>
        {children}
        <MapControl icon={Gps01Icon} label="Recenter map" onPress={recenter} />
      </View>
    </View>
  );
}

const at = (place: Coordinates, id: string, kind: PinKind): MapPoint => ({
  id,
  kind,
  latitude: place.latitude,
  longitude: place.longitude,
});

/**
 * The delivery boy's own pin: the truck, turned the way they are heading, while their live trip
 * is being tracked; the rider otherwise.
 */
function useSelfPin(live: Coordinates | null) {
  const tracking = useTrackingStatus().running;
  const previous = useRef<Coordinates | null>(null);
  const [bearing, setBearing] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!live) return;
    const before = previous.current;
    previous.current = live;
    const next = before ? travelBearing([before, live]) : undefined;
    if (next !== undefined) setBearing(next);
  }, [live]);
  return useCallback(
    (place: Coordinates, id: string): MapPoint =>
      tracking ? { ...at(place, id, "truck"), bearing } : at(place, id, "rider"),
    [bearing, tracking],
  );
}

/** An order's pin, with the card its tap opens (receiver, call, address and map links). */
const orderMapPoint = (order: OrderPoint): MapPoint => ({
  ...at(order, `order-${order.orderId}`, order.exact ? "order" : "order-area"),
  detail: {
    address: order.address,
    exact: order.exact,
    mobile: order.mobile,
    receiver: order.receiver,
    title: order.awbNo,
  },
});

export function HomeMap({
  checkIn,
  checkOut,
  deliveryBoy = false,
  height,
  live,
  orders,
  organization,
  resetKey = 0,
  animateHeight = true,
  liveTrip = null,
}: Props) {
  // Height changes (the page settling, the day's record growing) ease in rather than jump.
  const animatedHeight = useSharedValue(height);
  useEffect(() => {
    animatedHeight.value = animateHeight
      ? withTiming(height, { duration: 280, easing: Easing.out(Easing.cubic) })
      : height;
  }, [animateHeight, animatedHeight, height]);
  const heightStyle = useAnimatedStyle(() => ({ height: animatedHeight.value }));
  const [expanded, setExpanded] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  // A reload (a new `resetKey`) drops a tapped pin; the maps then recenter.
  useEffect(() => {
    if (resetKey) setFocusId(null);
  }, [resetKey]);
  // With no orders to deliver, a delivery boy's map opens zoomed in on where they are.
  const anchorId = deliveryBoy && !orders && live ? "here" : null;
  // An order's pin opens the full-screen map on it, with its address and map links; any other
  // pin just zooms in where it is.
  const focusFromPage = (point: MapPoint | null) => {
    setFocusId(point?.id ?? null);
    if (point?.detail) setExpanded(true);
  };
  const minimize = () => {
    setExpanded(false);
    setFocusId(null);
  };
  // Organisation: for everyone but delivery boys. A delivery boy with orders to deliver: where
  // they are now and a pin per order (exact address, or only its area). Otherwise, before
  // checking in: where the user is now; after, the check-in point replaces it, and a check-out
  // adds the destination pin.
  const selfPin = useSelfPin(live);
  const points = useMemo(() => {
    const here = live ? (deliveryBoy ? selfPin(live, "here") : at(live, "here", "start")) : null;
    const day: (MapPoint | null)[] = orders
      ? [here, ...orders.map(orderMapPoint)]
      : [
          // A delivery boy stays on the map after checking in, beside the day's pins.
          checkIn ? at(checkIn, "check-in", "transit") : deliveryBoy ? null : here,
          deliveryBoy ? here : null,
          checkOut ? at(checkOut, "check-out", "destination") : null,
        ];
    const office = organization && !deliveryBoy ? at(organization, "office", "organization") : null;
    return [office, ...day].filter((point): point is MapPoint => point !== null);
  }, [checkIn, checkOut, deliveryBoy, live, orders, organization, selfPin]);
  return (
    <>
      <Animated.View style={heightStyle}>
        <View className="flex-1 border border-border overflow-hidden rounded-2xl bg-accent">
          {liveTrip ? (
            <LiveTripMap
              action="expand"
              controlsTop={16}
              legendBottom={12}
              onAction={liveTrip.onExpand}
              path={liveTrip.path}
              stops={liveTrip.stops}
              vehicle={liveTrip.vehicle}
            />
          ) : (
            <NativeOlaMap
              anchorId={anchorId}
              controlsTop={16}
              // Under the full-screen map the small one keeps the overview.
              focusId={expanded ? null : focusId}
              legendBottom={12}
              onFocus={focusFromPage}
              origin={live}
              points={points}
              resetKey={resetKey}
              showLegend={!deliveryBoy}
            >
              <MapControl
                icon={FullScreenIcon}
                label="Maximize map"
                onPress={() => setExpanded(true)}
              />
            </NativeOlaMap>
          )}
        </View>
      </Animated.View>
      <Modal animationType="fade" onRequestClose={minimize} visible={expanded}>
        <View className="flex-1 bg-accent">
          <NativeOlaMap
            anchorId={anchorId}
            controlsTop={56}
            focusId={focusId}
            legendBottom={40}
            onFocus={(point) => setFocusId(point?.id ?? null)}
            origin={live}
            points={points}
            resetKey={resetKey}
            showLegend={!deliveryBoy}
          >
            <MapControl icon={Cancel01Icon} label="Minimize map" onPress={minimize} />
          </NativeOlaMap>
        </View>
      </Modal>
    </>
  );
}

// The route is fetched again only once the user has moved about this far (≈ 100 m).
const ROUTE_GRID_DEGREES = 0.001;

/** "850 m", "12.4 km"; "6 min", "1 hr 5 min". */
function tripLabel({ distanceMeters, durationSeconds }: RoadRoute) {
  const distance =
    distanceMeters == null
      ? null
      : distanceMeters < 1000
        ? `${Math.round(distanceMeters)} m`
        : `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
  const minutes = durationSeconds == null ? null : Math.max(1, Math.round(durationSeconds / 60));
  const duration =
    minutes == null
      ? null
      : minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return [distance, duration].filter(Boolean).join(" · ") || null;
}

/** The road route from the user to the order, refetched as they move on (not on every step). */
function useRoadRoute(
  from: Coordinates | null,
  to: Coordinates | null,
  grid: number = ROUTE_GRID_DEGREES,
) {
  const { token } = useAuthSession();
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const snap = (value: number) => Math.round(value / grid) * grid;
  const fromLat = from ? snap(from.latitude) : null;
  const fromLng = from ? snap(from.longitude) : null;
  const toLat = to?.latitude ?? null;
  const toLng = to?.longitude ?? null;
  useEffect(() => {
    if (!token || fromLat == null || fromLng == null || toLat == null || toLng == null) {
      setRoute(null);
      return;
    }
    let current = true;
    fetchRoute(
      token,
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
    )
      .then((next) => {
        if (current) setRoute(next);
      })
      .catch(() => {
        if (current) setRoute(null);
      });
    return () => {
      current = false;
    };
  }, [fromLat, fromLng, toLat, toLng, token]);
  return route;
}

/**
 * A delivered order is shown as it ended: its address (the destination pin) and the spot where
 * it was handed over (from Confirm Delivery). One still to deliver: the delivery boy and the
 * order, with the road between them.
 */
export type OrderMapState = {
  delivered: boolean;
  /** Where it was handed over, with the address saved then (null for older deliveries). */
  deliveredAt: (Coordinates & { address?: string | null }) | null;
};

function useOrderMapView(live: Coordinates | null, order: OrderPoint | null, state: OrderMapState) {
  const point = useMemo(() => (order ? orderMapPoint(order) : null), [order]);
  const { delivered, deliveredAt } = state;
  const route = useRoadRoute(delivered ? null : live, delivered ? null : order);
  const handedOver = delivered && deliveredAt ? deliveredAt : null;
  const selfPin = useSelfPin(delivered ? null : live);
  const points = useMemo(
    () =>
      [
        delivered ? null : live ? selfPin(live, "here") : null,
        point,
        handedOver
          ? {
              ...at(handedOver, "delivered-at", "delivered-at"),
              info: { address: handedOver.address ?? null, title: "Delivered Location" },
            }
          : null,
      ].filter((item): item is MapPoint => item !== null),
    [delivered, handedOver, live, point, selfPin],
  );
  return { point, points, route: delivered ? null : route };
}

/**
 * One order on the full-screen map (an order card's View on Map): the delivery boy and the
 * order's pin with the best road route between them highlighted, all framed together. The
 * order's card (receiver, call, the distance and drive time, View Location and Directions) is
 * open from the start in the legend's place; closing it brings the legend back. Shown while
 * `order` is set.
 */
export function OrderLocationMap({
  live,
  onClose,
  order,
  state = { delivered: false, deliveredAt: null },
}: {
  live: Coordinates | null;
  onClose: () => void;
  order: OrderPoint | null;
  state?: OrderMapState;
}) {
  const { point, points, route } = useOrderMapView(live, order, state);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Every order opens with its card showing.
  useEffect(() => {
    setFocusId(point?.id ?? null);
  }, [point?.id]);
  return (
    <Modal animationType="fade" onRequestClose={onClose} visible={order !== null}>
      <View className="flex-1 bg-accent">
        {order ? (
          <NativeOlaMap
            anchorId={null}
            controlsTop={56}
            focusId={focusId}
            legendBottom={40}
            onFocus={(next) => setFocusId(next?.id ?? null)}
            origin={live}
            points={points}
            resetKey={0}
            route={route?.coordinates ?? null}
            showLegend
            trip={route ? tripLabel(route) : null}
            callable={false}
            zoomOnFocus={false}
          >
            <MapControl icon={Cancel01Icon} label="Close map" onPress={onClose} />
          </NativeOlaMap>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * One order on a map in the page (the update page's bottom block): the delivery boy, the order's
 * pin and the road between them, framed together, with the legend and the trip's distance and
 * drive time; a delivered order shows its address and where it was handed over instead (see
 * `OrderMapState`). Maximize opens the full-screen map.
 */
export function OrderRouteMap({
  height,
  live,
  onExpand,
  order,
  state = { delivered: false, deliveredAt: null },
}: {
  height: number;
  live: Coordinates | null;
  onExpand: () => void;
  order: OrderPoint;
  state?: OrderMapState;
}) {
  const { points, route } = useOrderMapView(live, order, state);
  const [focusId, setFocusId] = useState<string | null>(null);
  const trip = route ? tripLabel(route) : null;
  return (
    <View className="overflow-hidden border border-border bg-accent" style={{ height }}>
      <NativeOlaMap
        anchorId={null}
        controlsTop={12}
        focusId={focusId}
        legendBottom={12}
        onFocus={(next) => setFocusId(next?.id ?? null)}
        origin={live}
        points={points}
        resetKey={0}
        route={route?.coordinates ?? null}
        showLegend
        trip={trip}
        callable={false}
        zoomOnFocus={false}
      >
        <MapControl icon={FullScreenIcon} label="Maximize map" onPress={onExpand} />
      </NativeOlaMap>
      {trip ? (
        <View
          className="absolute top-3 right-3 bg-white px-2.5 py-1.5"
          pointerEvents="none"
          style={{ elevation: 3 }}
        >
          <Text className="text-xs font-medium text-primary">{trip}</Text>
        </View>
      ) : null}
    </View>
  );
}

// A live trip's road ahead is fetched again only once the truck has moved about this far (≈ 500 m):
// the server already measures the distance left, so the map needs only the rough way.
const LIVE_ROUTE_GRID_DEGREES = 0.005;
// Points closer than this give no reliable direction of travel.
const BEARING_MIN_METRES = 10;

/** Direction of travel (degrees from north) from the last two points far enough apart. */
function travelBearing(path: Coordinates[]) {
  const last = path.at(-1);
  if (!last) return undefined;
  for (let i = path.length - 2; i >= 0; i -= 1) {
    const from = path[i];
    if (!from || distanceInMetres(from, last) < BEARING_MIN_METRES) continue;
    const toRadians = Math.PI / 180;
    const dLng = (last.longitude - from.longitude) * toRadians;
    const lat1 = from.latitude * toRadians;
    const lat2 = last.latitude * toRadians;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  return undefined;
}

/** A delivery on a live trip's map. */
export type TripStop = Coordinates & { id: string; title: string; address: string | null };

const placeKey = (place: Coordinates) =>
  `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;

/**
 * The order a vehicle will most likely take its stops in: always the nearest one left, starting
 * from where it is (or the first stop while its position isn't known). Orders at the same place
 * (two parcels to one station) are one stop.
 */
function visitOrder(from: Coordinates | null, stops: TripStop[]) {
  // `Map` here is the map view; the built-in keyed collection is `globalThis.Map`.
  const left = [...new globalThis.Map(stops.map((stop) => [placeKey(stop), stop])).values()];
  const ordered: TripStop[] = [];
  let here = from;
  while (left.length) {
    let best = 0;
    if (here) {
      const origin = here;
      left.forEach((stop, index) => {
        const current = left[best];
        if (current && distanceInMetres(origin, stop) < distanceInMetres(origin, current)) {
          best = index;
        }
      });
    }
    const [next] = left.splice(best, 1);
    if (!next) break;
    ordered.push(next);
    here = next;
  }
  return ordered;
}

/**
 * The predicted road path from the vehicle through every stop to the last, one routed leg per
 * hop (each Redis-cached on the server). A leg the router can't find is drawn straight.
 * Fetched again only when the vehicle has moved about 500 m or the stops change.
 */
function usePlannedRoute(vehicle: Coordinates | null, stops: TripStop[]) {
  const { token } = useAuthSession();
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const snap = (value: number) =>
    Math.round(value / LIVE_ROUTE_GRID_DEGREES) * LIVE_ROUTE_GRID_DEGREES;
  const start = vehicle
    ? { latitude: snap(vehicle.latitude), longitude: snap(vehicle.longitude) }
    : null;
  const ordered = visitOrder(start, stops);
  const hops = [...(start ? [start] : []), ...ordered];
  const key = hops.map(placeKey).join("|");
  useEffect(() => {
    const places = key
      ? key.split("|").map((part) => {
          const [latitude, longitude] = part.split(",").map(Number);
          return { latitude: latitude ?? 0, longitude: longitude ?? 0 };
        })
      : [];
    if (!token || places.length < 2) {
      setRoute(null);
      return;
    }
    let current = true;
    const legs = places.slice(1).map((to, index) => {
      const from = places[index] as Coordinates;
      return fetchRoute(token, from, to)
        .catch(() => null)
        .then(
          (leg): RoadRoute =>
            leg ?? {
              coordinates: [
                [from.longitude, from.latitude],
                [to.longitude, to.latitude],
              ],
              distanceMeters: distanceInMetres(from, to),
              durationSeconds: null,
            },
        );
    });
    void Promise.all(legs).then((parts) => {
      if (!current) return;
      const sum = (pick: (part: RoadRoute) => number | null) =>
        parts.every((part) => pick(part) != null)
          ? parts.reduce((total, part) => total + (pick(part) ?? 0), 0)
          : null;
      setRoute({
        // Each leg starts where the last one ended; the shared point is drawn once.
        coordinates: parts.flatMap((part, index) =>
          index ? part.coordinates.slice(1) : part.coordinates,
        ),
        distanceMeters: sum((part) => part.distanceMeters),
        durationSeconds: sum((part) => part.durationSeconds),
      });
    });
    return () => {
      current = false;
    };
  }, [key, token]);
  return route;
}

/**
 * A live delivery trip on a full-size map: the way the vehicle has come (faint), the truck at
 * its current position turned to its direction of travel, every order on the sheet, and the
 * predicted road path from the truck through each stop to the last one.
 */
export function LiveTripMap({
  action = "close",
  controlsTop,
  legendBottom,
  onAction,
  path,
  stops,
  vehicle,
}: {
  /** The corner control: close the full-screen map, or open it from a map in a page. */
  action?: "close" | "expand";
  controlsTop: number;
  legendBottom: number;
  /** GPS points the server holds, oldest first. */
  path: Coordinates[];
  /** Every order still to deliver on the trip. */
  stops: TripStop[];
  /** Where the vehicle is now: the latest point, or the driver's own phone before the first. */
  vehicle: Coordinates | null;
  onAction: () => void;
}) {
  const route = usePlannedRoute(vehicle, stops);
  const [focusId, setFocusId] = useState<string | null>(null);
  const points = useMemo(() => {
    const start = path.length > 1 ? path[0] : undefined;
    const heading = vehicle ? [...path, vehicle] : path;
    return [
      start ? at(start, "trip-start", "start") : null,
      ...stops.map((stop) => ({
        ...at(stop, `trip-stop-${stop.id}`, "order" as const),
        info: { address: stop.address, title: stop.title },
      })),
      vehicle ? { ...at(vehicle, "trip-truck", "truck"), bearing: travelBearing(heading) } : null,
    ].filter((item): item is MapPoint => item !== null);
  }, [path, stops, vehicle]);
  const trail = useMemo(
    () => path.map((point) => [point.longitude, point.latitude] as [number, number]),
    [path],
  );
  return (
    <NativeOlaMap
      anchorId={null}
      callable={false}
      controlsTop={controlsTop}
      focusId={focusId}
      legendBottom={legendBottom}
      onFocus={(next) => setFocusId(next?.id ?? null)}
      origin={vehicle}
      points={points}
      resetKey={0}
      route={route?.coordinates ?? null}
      showLegend={false}
      trail={trail}
      trip={route ? tripLabel(route) : null}
      zoomOnFocus={false}
    >
      {action === "expand" ? (
        <MapControl icon={FullScreenIcon} label="Open the live trip map" onPress={onAction} />
      ) : (
        <MapControl icon={Cancel01Icon} label="Close map" onPress={onAction} />
      )}
    </NativeOlaMap>
  );
}
