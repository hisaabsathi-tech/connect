import { Image02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { PhotoDialog } from "@/components/modules/photo";
import { BottomSheet } from "@/components/modules/sheet";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { HomeMap } from "@/features/home/components/home-map";
import {
  type AttendanceRecord,
  checkInPointOf,
  checkOutPointOf,
  fetchMyAttendancePhotos,
} from "@/lib/api/attendance";
import { fetchRosterPhotos } from "@/lib/api/attendance-roster";
import { formatClock, formatDayLabel } from "@/lib/date";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";

type Side = "checkIn" | "checkOut";
type Option = { kind: "location" | "photo"; side: Side };

const OPTION_LABELS: Record<`${Side}-${Option["kind"]}`, string> = {
  "checkIn-location": "Check-In Location",
  "checkIn-photo": "Check-In Photo",
  "checkOut-location": "Check-Out Location",
  "checkOut-photo": "Check-Out Photo",
};

const keyOf = (option: Option) => `${option.side}-${option.kind}` as const;

/** The options a record has data for, in check-in then check-out order. */
function optionsOf(record: AttendanceRecord): Option[] {
  const options: Option[] = [];
  if (checkInPointOf(record)) options.push({ kind: "location", side: "checkIn" });
  if (record.hasCheckInPhoto) options.push({ kind: "photo", side: "checkIn" });
  if (checkOutPointOf(record)) options.push({ kind: "location", side: "checkOut" });
  if (record.hasCheckOutPhoto) options.push({ kind: "photo", side: "checkOut" });
  return options;
}

/** Whether tapping the card has anything to show. */
export function hasAttendanceDetails(record: AttendanceRecord | null) {
  return Boolean(record && optionsOf(record).length);
}

/** Both photos' signed URLs for a record, fetched once when the sheet opens on it. */
/** Whose record it is: the member's own, or any employee's on the organisation's roster. */
export type DetailScope = "mine" | "organization";

function usePhotos(token: string | null, record: AttendanceRecord | null, scope: DetailScope) {
  const [photos, setPhotos] = useState<Record<Side, string | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wanted = Boolean(record && (record.hasCheckInPhoto || record.hasCheckOutPhoto));
  useEffect(() => {
    setPhotos(null);
    setError(null);
    if (!(token && record && wanted)) return;
    let active = true;
    const fetchPhotos = scope === "organization" ? fetchRosterPhotos : fetchMyAttendancePhotos;
    fetchPhotos(token, record.id, record.date)
      .then((next) => {
        if (active) setPhotos(next);
      })
      .catch((fetchError: unknown) => {
        if (active) setError(errorMessage(fetchError, "Could not load the photo."));
      });
    return () => {
      active = false;
    };
  }, [record, scope, token, wanted]);
  return { error, photos };
}

/**
 * A day's check-in and check-out details in a bottom sheet: up to four options on top (each
 * side's location and photo, only those the day has), and below them the chosen one: the map
 * with the pin and full address, or the photo (tap for full screen, pinch to zoom).
 */
export function AttendanceDetailSheet({
  heading,
  onClose,
  record,
  scope = "mine",
  token,
}: {
  /** Shown above the date, e.g. the employee's name on the organisation's roster. */
  heading?: string;
  onClose: () => void;
  /** The tapped day's session; null closes the sheet. */
  record: AttendanceRecord | null;
  scope?: DetailScope;
  token: string | null;
}) {
  const { height } = useWindowDimensions();
  // Kept while the sheet slides away, so its content doesn't vanish mid-animation.
  const [shown, setShown] = useState<AttendanceRecord | null>(record);
  const [selected, setSelected] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  if (record && record !== shown) {
    setShown(record);
    setSelected(null);
  }
  const { error, photos } = usePhotos(token, shown, scope);
  // Kept with the record, so the heading doesn't vanish while the sheet slides away.
  const [shownHeading, setShownHeading] = useState(heading);
  if (record && heading !== shownHeading) setShownHeading(heading);
  const options = useMemo(() => (shown ? optionsOf(shown) : []), [shown]);
  const option = options.find((item) => keyOf(item) === selected) ?? options[0];
  const checkIn = useMemo(() => (shown ? checkInPointOf(shown) : null), [shown]);
  const checkOut = useMemo(() => (shown ? checkOutPointOf(shown) : null), [shown]);
  const contentHeight = Math.round(height * 0.38);

  let content = null;
  if (shown && option) {
    const time = option.side === "checkIn" ? shown.checkInAt : shown.checkOutAt;
    const verb = option.side === "checkIn" ? "Checked in" : "Checked out";
    if (option.kind === "location") {
      const point = option.side === "checkIn" ? checkIn : checkOut;
      content = (
        <>
          <HomeMap
            checkIn={option.side === "checkIn" ? checkIn : null}
            checkOut={option.side === "checkOut" ? checkOut : null}
            height={contentHeight}
            live={null}
            organization={null}
          />
          <View className="mt-3 flex-row gap-2">
            <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={18} />
            <View className="flex-1">
              <Text className="text-sm text-foreground">
                {point?.address || `${point?.latitude.toFixed(5)}, ${point?.longitude.toFixed(5)}`}
              </Text>
              {time ? (
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {verb} at {formatClock(time)}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      );
    } else {
      const uri = photos?.[option.side] ?? null;
      content = (
        <>
          <Pressable
            accessibilityHint="Opens the photo full screen"
            accessibilityRole="button"
            className="items-center justify-center border border-border bg-muted"
            disabled={!uri}
            onPress={() => setFullScreen(true)}
            style={{ height: contentHeight }}
          >
            {uri ? (
              <Image
                contentFit="cover"
                source={{ uri }}
                style={{ height: "100%", width: "100%" }}
              />
            ) : error || (photos && !uri) ? (
              <Text className="px-6 text-center text-sm text-muted-foreground">
                {error ?? "This photo is not available."}
              </Text>
            ) : (
              <Loader fullHeight={false} size="sm" transparent />
            )}
          </Pressable>
          <View className="mt-3 flex-row gap-2">
            <HugeiconsIcon color={colors.primary} icon={Image02Icon} size={18} />
            <Text className="flex-1 text-sm text-foreground">
              {time ? `Photo taken when ${verb.toLowerCase()} at ${formatClock(time)}` : "Photo"}
              {uri ? ". Tap to view full screen." : ""}
            </Text>
          </View>
        </>
      );
    }
  }

  return (
    <>
      <BottomSheet dragHandleOnly onClose={onClose} visible={Boolean(record)}>
        {shown ? (
          <>
            {shownHeading ? (
              <Text className="mt-2 text-xl font-semibold leading-7 text-foreground">
                {shownHeading}
              </Text>
            ) : null}
            <Text
              className={
                shownHeading
                  ? "text-sm font-medium text-foreground"
                  : "mt-2 text-xl font-semibold leading-7 text-foreground"
              }
            >
              {formatDayLabel(shown.date, "long")}
            </Text>
            <Text className="mt-0.5 text-sm text-muted-foreground">
              {formatClock(shown.checkInAt)} -{" "}
              {shown.checkOutAt ? formatClock(shown.checkOutAt) : "Not checked out"}
            </Text>
            <View className="mt-4 flex-row flex-wrap gap-2">
              {options.map((item) => {
                const active = option && keyOf(item) === keyOf(option);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`h-10 flex-row items-center justify-center gap-1.5 border px-2 ${active ? "border-primary bg-primary" : "border-border bg-card"}`}
                    key={keyOf(item)}
                    onPress={() => {
                      haptic("selection");
                      setSelected(keyOf(item));
                    }}
                    // Two per row: four options make a 2×2 grid.
                    style={{ width: "48.5%" }}
                  >
                    <HugeiconsIcon
                      color={active ? colors.primaryForeground : colors.mutedForeground}
                      icon={item.kind === "location" ? Location01Icon : Image02Icon}
                      size={16}
                    />
                    <Text
                      className={`text-sm ${active ? "font-medium text-primary-foreground" : "text-foreground"}`}
                      numberOfLines={1}
                    >
                      {OPTION_LABELS[keyOf(item)]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-4">{content}</View>
          </>
        ) : null}
      </BottomSheet>
      <PhotoDialog
        error={error}
        onClose={() => setFullScreen(false)}
        title={option?.side === "checkOut" ? "Check-out photo" : "Check-in photo"}
        uri={option?.kind === "photo" ? (photos?.[option.side] ?? null) : null}
        visible={fullScreen && option?.kind === "photo"}
      />
    </>
  );
}
