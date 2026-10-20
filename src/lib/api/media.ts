import { apiRequest } from "@/lib/api/client";

const UPLOAD_FAILED =
  "The photo could not be uploaded. Check your internet connection and try again.";

/** Sends the file's bytes to the presigned storage URL. */
function putObject(uploadUrl: string, body: Blob, mimeType: string) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(UPLOAD_FAILED));
    xhr.onerror = () => reject(new Error(UPLOAD_FAILED));
    xhr.send(body);
  });
}

/**
 * Uploads a local JPEG (`file://…`) as an `attendance_photo` and returns its media id, which
 * check-in and check-out send as `media`.
 */
export async function uploadAttendancePhoto(token: string, uri: string): Promise<string> {
  const mimeType = "image/jpeg";
  const { mediaId, uploadUrl } = await apiRequest<{ mediaId: string; uploadUrl: string }>(
    "/media/upload-url",
    token,
    { body: JSON.stringify({ kind: "attendance_photo", mimeType }), method: "POST" },
  );
  const file = await fetch(uri).then((response) => response.blob());
  await putObject(uploadUrl, file, mimeType);
  await apiRequest(`/media/${encodeURIComponent(mediaId)}/confirm`, token, { method: "POST" });
  return mediaId;
}
