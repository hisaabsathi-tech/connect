import { apiRequest } from "@/lib/api/client";
import { graphqlRequest } from "@/lib/api/graphql";
import type { Coordinates } from "@/lib/maps/geo";

export type Point = Coordinates & { address?: string | null };

/** Server-computed remarks from the organisation's working hours (same as the web roster). */
export type AttendanceSubStatus = "LATE_ENTRY" | "MISSED_CHECKOUT" | "OVERTIME";

export type AttendanceSession = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  /** AUTO when the organisation's auto-checkout closed the session. */
  checkOutKind?: "AUTO" | "MANUAL" | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAddress?: string | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAddress?: string | null;
  /** Only on days read back from `myAttendances`. */
  subStatuses?: AttendanceSubStatus[];
  /** A photo was taken (Image Confirmation module). Only on days read back from `myAttendances`. */
  hasCheckInPhoto?: boolean;
  hasCheckOutPhoto?: boolean;
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

export function fetchOpenAttendance(token: string) {
  return apiRequest<{
    attendance: AttendanceSession | null;
    attendedToday: boolean;
    /** The organisation's Image Confirmation module: a photo is required to check in or out. */
    imageConfirmation?: boolean;
  }>("/organizations/me/attendance/open", token);
}

const MY_ATTENDANCE_DAY_QUERY = `
query ConnectorAttendanceDay($date: String!) {
  myAttendances(from: $date, to: $date) {
    items {
      id checkInAt checkOutAt checkOutKind subStatuses hasCheckInPhoto hasCheckOutPhoto
      checkInAddress checkInLatitude checkInLongitude
      checkOutAddress checkOutLatitude checkOutLongitude
    }
    nonWorkingDays { date name }
  }
}`;

export type AttendanceDay = {
  /** The latest session that day, or null. */
  record: AttendanceSession | null;
  /** Holiday name or weekday when the organisation's calendar marks the day off, else null. */
  offDay: string | null;
};

/** The signed-in member's attendance on one `YYYY-MM-DD` day, with the org's calendar for it. */
export async function fetchMyAttendanceOn(token: string, date: string): Promise<AttendanceDay> {
  const payload = await graphqlRequest<{
    myAttendances: {
      items: AttendanceSession[];
      nonWorkingDays: { date: string; name: string }[];
    };
  }>({ query: MY_ATTENDANCE_DAY_QUERY, token, variables: { date } });
  const { items, nonWorkingDays } = payload.myAttendances;
  return {
    offDay: nonWorkingDays.find((day) => day.date === date)?.name ?? null,
    record: items.at(-1) ?? null,
  };
}

/** `media` is the uploaded photo's id, required when Image Confirmation is on. */
export function checkIn(token: string, point: Point, media?: string) {
  return apiRequest<{ attendance: AttendanceSession }>(
    "/organizations/me/attendance/check-in",
    token,
    { body: JSON.stringify({ ...point, media }), method: "POST" },
  );
}

export function checkOut(token: string, point: Point, media?: string) {
  return apiRequest<{ attendance: AttendanceSession }>(
    "/organizations/me/attendance/check-out",
    token,
    { body: JSON.stringify({ ...point, media }), method: "POST" },
  );
}

/** Fresh signed URLs for the member's own photos on one record; null where none was taken. */
export async function fetchMyAttendancePhotos(token: string, id: string, date: string) {
  const { photos } = await apiRequest<{
    photos: { checkIn: string | null; checkOut: string | null };
  }>(
    `/organizations/me/attendance/my/${encodeURIComponent(id)}/photos?date=${encodeURIComponent(date)}`,
    token,
  );
  return photos;
}
