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

type MediaKind = "attendance_photo" | "order_pod" | "user_image";

export type UploadedMedia = {
  mediaId: string;
  /** Storage key; what profile fields such as the user image store. */
  objectKey: string;
  /** Presigned view URL, good for showing the upload right away. */
  viewUrl?: string;
};

/** Uploads a local JPEG (`file://…`): presigned URL → PUT the bytes → confirm. */
async function uploadJpeg(token: string, uri: string, kind: MediaKind): Promise<UploadedMedia> {
  const mimeType = "image/jpeg";
  const { mediaId, uploadUrl } = await apiRequest<{ mediaId: string; uploadUrl: string }>(
    "/media/upload-url",
    token,
    { body: JSON.stringify({ kind, mimeType }), method: "POST" },
  );
  const file = await fetch(uri).then((response) => response.blob());
  await putObject(uploadUrl, file, mimeType);
  return apiRequest<UploadedMedia>(`/media/${encodeURIComponent(mediaId)}/confirm`, token, {
    method: "POST",
  });
}

/** Uploads an `attendance_photo`; check-in and check-out send its media id as `media`. */
export async function uploadAttendancePhoto(token: string, uri: string): Promise<string> {
  return (await uploadJpeg(token, uri, "attendance_photo")).mediaId;
}

/** Uploads a profile photo (`user_image`). */
export function uploadProfilePhoto(token: string, uri: string): Promise<UploadedMedia> {
  return uploadJpeg(token, uri, "user_image");
}

/** Uploads the scan of a signed DRS (`order_pod`); the DRS stores its `objectKey`. */
export function uploadDrsScan(token: string, uri: string): Promise<UploadedMedia> {
  return uploadJpeg(token, uri, "order_pod");
}
