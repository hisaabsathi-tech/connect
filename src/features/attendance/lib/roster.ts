import type { AttendanceRecord } from "@/lib/api/attendance";
import type { RosterRow } from "@/lib/api/attendance-roster";

/** A present roster row in the shape of the member's own records, for the shared cards and sheet. */
export function recordOfRow(row: RosterRow): AttendanceRecord | null {
  if (row.status !== "PRESENT" || !row.checkInAt) return null;
  return {
    checkInAddress: row.address,
    checkInAt: row.checkInAt,
    checkInLatitude: row.latitude,
    checkInLongitude: row.longitude,
    checkOutAddress: row.checkOutAddress,
    checkOutAt: row.checkOutAt,
    checkOutKind:
      row.checkOutKind === "AUTO" || row.checkOutKind === "MANUAL" ? row.checkOutKind : null,
    checkOutLatitude: row.checkOutLatitude,
    checkOutLongitude: row.checkOutLongitude,
    date: row.date,
    hasCheckInPhoto: row.hasCheckInPhoto,
    hasCheckOutPhoto: row.hasCheckOutPhoto,
    id: row.id,
    subStatuses: row.subStatuses,
  };
}
