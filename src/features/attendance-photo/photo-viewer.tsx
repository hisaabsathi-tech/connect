import { useEffect, useState } from "react";

import { PhotoDialog } from "@/components/modules/photo";
import { fetchMyAttendancePhotos } from "@/lib/api/attendance";
import { errorMessage } from "@/lib/errors";

export type PhotoViewerTarget = {
  /** The attendance record's id. */
  id: string;
  /** The record's `YYYY-MM-DD` day. */
  date: string;
  side: "checkIn" | "checkOut";
};

interface PhotoViewerProps {
  token: string | null;
  target: PhotoViewerTarget | null;
  onClose: () => void;
}

/** The member's own check-in or check-out photo, fetched on open, in the shared photo dialog. */
export function PhotoViewer({ token, target, onClose }: PhotoViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!(token && target)) return;
    let active = true;
    fetchMyAttendancePhotos(token, target.id, target.date)
      .then((photos) => {
        if (!active) return;
        const next = photos[target.side];
        if (next) setUrl(next);
        else setError("This photo is not available.");
      })
      .catch((fetchError: unknown) => {
        if (active) setError(errorMessage(fetchError, "Could not load the photo."));
      });
    return () => {
      active = false;
    };
  }, [target, token]);

  const title = target?.side === "checkOut" ? "Check-out photo" : "Check-in photo";

  return (
    <PhotoDialog
      error={error}
      onClose={onClose}
      title={title}
      uri={url}
      visible={target !== null}
    />
  );
}
