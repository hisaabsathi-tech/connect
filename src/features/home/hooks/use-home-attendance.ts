import { useCallback, useEffect, useState } from "react";

import { useDialog } from "@/components/modules/dialog";
import {
  type AttendanceSession,
  checkIn,
  checkOut,
  fetchOpenAttendance,
  type Point,
} from "@/lib/api/attendance";
import { fetchHomeIdentity, type HomeIdentity } from "@/lib/api/home";
import { geocodeAddress } from "@/lib/api/maps";
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
      const [nextIdentity, { attendance, attendedToday: attended }] = await Promise.all([
        fetchHomeIdentity(token),
        fetchOpenAttendance(token),
      ]);
      setIdentity(nextIdentity);
      setOpen(attendance);
      setAttendedToday(attended);
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
   * Checks in, or out when a session is open, at the live position. Resolves to the saved
   * session (server times), or null when nothing was saved.
   */
  const submit = useCallback(async (): Promise<AttendanceSession | null> => {
    if (!(token && live) || busy) return null;
    setBusy(true);
    try {
      const point: Point = { ...live, address: await reverseGeocodeAddress(live) };
      const result = open ? await checkOut(token, point) : await checkIn(token, point);
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
  }, [busy, dialog, live, open, playSound, token]);

  return {
    attendedToday,
    busy,
    identity,
    isCheckedIn: Boolean(open),
    organization,
    refresh,
    refreshing,
    statusLoaded,
    submit,
  };
}
