import { apiRequest } from "@/lib/api/client";
import type { Coordinates } from "@/lib/maps/geo";

export type Point = Coordinates & { address?: string | null };

export type AttendanceSession = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAddress?: string | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAddress?: string | null;
};

export function checkInPointOf(session: AttendanceSession | null): Point | null {
  if (session?.checkInLatitude == null || session.checkInLongitude == null) return null;
  return {
    address: session.checkInAddress,
    latitude: session.checkInLatitude,
    longitude: session.checkInLongitude,
  };
}

export function checkOutPointOf(session: AttendanceSession | null): Point | null {
  if (session?.checkOutLatitude == null || session.checkOutLongitude == null) return null;
  return {
    address: session.checkOutAddress,
    latitude: session.checkOutLatitude,
    longitude: session.checkOutLongitude,
  };
}

/**
 * The open session (null once checked out), whether the member attended today, and today's
 * latest session even when closed, for showing where they checked in and out.
 */
export function fetchOpenAttendance(token: string) {
  return apiRequest<{
    attendance: AttendanceSession | null;
    attendedToday: boolean;
    today?: AttendanceSession | null;
  }>("/organizations/me/attendance/open", token);
}

export function checkIn(token: string, point: Point) {
  return apiRequest<{ attendance: AttendanceSession }>(
    "/organizations/me/attendance/check-in",
    token,
    { body: JSON.stringify(point), method: "POST" },
  );
}

export function checkOut(token: string, point: Point) {
  return apiRequest<{ attendance: AttendanceSession }>(
    "/organizations/me/attendance/check-out",
    token,
    { body: JSON.stringify(point), method: "POST" },
  );
}
