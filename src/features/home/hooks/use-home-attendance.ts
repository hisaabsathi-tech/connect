import { useCallback, useEffect, useState } from "react";

import { useDialog } from "@/components/modules/dialog";
import { useAttendancePhoto } from "@/features/attendance-photo";
import {
  type AttendanceSession,
  checkIn,
  checkOut,
  fetchOpenAttendance,
  type Point,
} from "@/lib/api/attendance";
import { fetchHomeIdentity, type HomeIdentity } from "@/lib/api/home";
import { geocodeAddress } from "@/lib/api/maps";
import { uploadAttendancePhoto } from "@/lib/api/media";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import type { Coordinates } from "@/lib/maps/geo";
import { reverseGeocodeAddress } from "@/lib/maps/ola-maps";

import { useAttendanceSounds } from "./use-attendance-sounds";

/**
 * The signed-in user, their organisation's location and today's check in/out state. The swipe
 * button is always about today, whichever day the calendar shows.
 */
export function useHomeAttendance(token: string | null, live: Coordinates | null) {
  const [identity, setIdentity] = useState<HomeIdentity | null>(null);
  const [organization, setOrganization] = useState<Coordinates | null>(null);
  const [open, setOpen] = useState<AttendanceSession | null>(null);
  const [attendedToday, setAttendedToday] = useState(false);
  // The organisation's Image Confirmation module: a photo is taken before every check in/out.
  const [imageConfirmation, setImageConfirmation] = useState(false);
  // False for a superadmin while the organisation's Superadmin Attendance module is off.
  const [selfAttendance, setSelfAttendance] = useState(true);
  const photo = useAttendancePhoto();
  // Until today's status arrives the button can't know whether to check in or out.
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useDialog();
  const playSound = useAttendanceSounds();

  /** Fetches the identity, today's attendance and the organisation's position from the server. */
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [nextIdentity, status] = await Promise.all([
        fetchHomeIdentity(token),
        fetchOpenAttendance(token),
      ]);
      setIdentity(nextIdentity);
      setOpen(status.attendance);
      setAttendedToday(status.attendedToday);
      setImageConfirmation(Boolean(status.imageConfirmation));
      // Older servers don't send it; everyone checked in before the module existed.
      setSelfAttendance(status.selfAttendance !== false);
      setStatusLoaded(true);
      const address = nextIdentity?.organization?.address;
      const place = address ? await geocodeAddress(address, token) : null;
      setOrganization(place ? { latitude: place.lat, longitude: place.lng } : null);
    } catch (error) {
      void dialog.alert({
        description: errorMessage(error, "Please try again."),
        title: "Could not load home",
        tone: "danger",
      });
    }
  }, [dialog, token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Pull-to-refresh: reloads everything on the page in place. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /**
   * Checks in, or out when a session is open, at the live position. With Image Confirmation on,
   * the photo flow runs first and its upload goes with the request. Resolves to the saved
   * session (server times), or null when nothing was saved (including a cancelled photo).
   */
  const submit = useCallback(async (): Promise<AttendanceSession | null> => {
    if (!(token && live) || busy) return null;
    setBusy(true);
    try {
      const uri = imageConfirmation ? await photo.capture() : null;
      if (imageConfirmation && !uri) return null;
      const [address, media] = await Promise.all([
        reverseGeocodeAddress(live),
        uri ? uploadAttendancePhoto(token, uri) : undefined,
      ]);
      const point: Point = { ...live, address };
      const result = open
        ? await checkOut(token, point, media)
        : await checkIn(token, point, media);
      setOpen(open ? null : result.attendance);
      setAttendedToday(true);
      haptic("success");
      playSound(open ? "out" : "in");
      return result.attendance;
    } catch (error) {
      haptic("error");
      void dialog.alert({
        description: errorMessage(error, "Please try again."),
        title: "Attendance was not updated",
        tone: "danger",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, dialog, imageConfirmation, live, open, photo.capture, playSound, token]);

  return {
    attendedToday,
    busy,
    identity,
    isCheckedIn: Boolean(open),
    organization,
    /** The camera / confirm screens; render once on the page. */
    photoModal: photo.modal,
    refresh,
    refreshing,
    /** Whether the user checks in and out at all; false hides the swipe for the attendance card. */
    selfAttendance,
    statusLoaded,
    submit,
  };
}
