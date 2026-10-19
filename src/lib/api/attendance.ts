import { apiRequest } from "@/lib/api/client";
import { graphqlRequest } from "@/lib/api/graphql";
import type { Coordinates } from "@/lib/maps/geo";

export type Point = Coordinates & { address?: string | null };

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
  return apiRequest<{ attendance: AttendanceSession | null; attendedToday: boolean }>(
    "/organizations/me/attendance/open",
    token,
  );
}

const MY_ATTENDANCE_DAY_QUERY = `
query ConnectorAttendanceDay($date: String!) {
  myAttendances(from: $date, to: $date) {
    items {
      id checkInAt checkOutAt checkOutKind
      checkInAddress checkInLatitude checkInLongitude
      checkOutAddress checkOutLatitude checkOutLongitude
    }
  }
}`;

/** The signed-in member's attendance on one `YYYY-MM-DD` day (the latest, if several), or null. */
export async function fetchMyAttendanceOn(token: string, date: string) {
  const payload = await graphqlRequest<{ myAttendances: { items: AttendanceSession[] } }>({
    query: MY_ATTENDANCE_DAY_QUERY,
    token,
    variables: { date },
  });
  return payload.myAttendances.items.at(-1) ?? null;
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
