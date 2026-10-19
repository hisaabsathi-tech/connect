import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import {
  type AttendanceSession,
  checkIn,
  checkInPointOf,
  checkOut,
  checkOutPointOf,
  fetchOpenAttendance,
  type Point,
} from "@/lib/api/attendance";
import { fetchHomeIdentity, type HomeIdentity } from "@/lib/api/home";
import { geocodeAddress } from "@/lib/api/maps";
import { errorMessage } from "@/lib/errors";
import type { Coordinates } from "@/lib/maps/geo";
import { reverseGeocodeAddress } from "@/lib/maps/ola-maps";

/** The signed-in user, their organisation's location and today's attendance, with check in/out. */
export function useHomeAttendance(token: string | null, live: Coordinates | null) {
  const [identity, setIdentity] = useState<HomeIdentity | null>(null);
  const [organization, setOrganization] = useState<Coordinates | null>(null);
  const [open, setOpen] = useState<AttendanceSession | null>(null);
  const [attendedToday, setAttendedToday] = useState(false);
  const [checkInPoint, setCheckInPoint] = useState<Point | null>(null);
  const [checkOutPoint, setCheckOutPoint] = useState<Point | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      setCheckInPoint(checkInPointOf(attendance));
      setCheckOutPoint(checkOutPointOf(attendance));
      const address = nextIdentity?.organization?.address;
      const place = address ? await geocodeAddress(address, token) : null;
      setOrganization(place ? { latitude: place.lat, longitude: place.lng } : null);
    } catch (error) {
      Alert.alert("Could not load home", errorMessage(error, "Please try again."));
    }
  }, [token]);

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

  /** Checks in, or out when a session is open, at the live position. */
  const submit = useCallback(async () => {
    if (!(token && live) || busy) return;
    setBusy(true);
    try {
      const point: Point = { ...live, address: await reverseGeocodeAddress(live) };
      if (open) {
        await checkOut(token, point);
        setCheckOutPoint(point);
        setOpen(null);
      } else {
        const result = await checkIn(token, point);
        setCheckInPoint(point);
        setOpen(result.attendance);
      }
      setAttendedToday(true);
    } catch (error) {
      Alert.alert("Attendance was not updated", errorMessage(error, "Please try again."));
    } finally {
      setBusy(false);
    }
  }, [busy, live, open, token]);

  return {
    attendedToday,
    busy,
    checkInPoint,
    checkOutPoint,
    identity,
    isCheckedIn: Boolean(open),
    organization,
    refresh,
    refreshing,
    submit,
  };
}
