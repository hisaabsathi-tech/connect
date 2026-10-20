import { useCallback, useRef, useState } from "react";
import { Modal } from "react-native";
import ImageCropPicker from "react-native-image-crop-picker";

import { useDialog } from "@/components/modules/dialog";
import { errorMessage } from "@/lib/errors";

import { PhotoConfirm } from "./photo-confirm";

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}

/**
 * Opens the phone's own camera app (front camera when it honours the hint). Returns the
 * compressed JPEG as a `file://` URI, or null when cancelled. No cropping step.
 */
async function takePhoto(): Promise<string | null> {
  try {
    const image = await ImageCropPicker.openCamera({
      compressImageMaxHeight: 1280,
      compressImageMaxWidth: 1280,
      compressImageQuality: 0.7,
      cropping: false,
      forceJpg: true,
      mediaType: "photo",
      useFrontCamera: true,
    });
    return image.path.startsWith("file://") ? image.path : `file://${image.path}`;
  } catch (error) {
    if (errorCode(error) === "E_PICKER_CANCELLED") return null;
    throw error;
  }
}

/**
 * The attendance photo flow: phone camera → Retake / Confirm. `capture`
 * resolves to the confirmed photo's local `file://` URI, or null when the user backs out.
 * Render `modal` once on the page.
 */
export function useAttendancePhoto() {
  const [uri, setUri] = useState<string | null>(null);
  const settle = useRef<((uri: string | null) => void) | null>(null);
  const dialog = useDialog();

  const finish = useCallback((result: string | null) => {
    setUri(null);
    settle.current?.(result);
    settle.current = null;
    // Captured and cropped files live in the cache; the confirmed one is uploaded from there.
    if (!result) void ImageCropPicker.clean().catch(() => undefined);
  }, []);

  /** Takes a photo; with nothing taken the flow ends, so Retake that is cancelled ends it too. */
  const shoot = useCallback(async () => {
    try {
      const next = await takePhoto();
      if (next) setUri(next);
      else finish(null);
    } catch (error) {
      finish(null);
      void dialog.alert({
        description:
          errorCode(error) === "E_NO_CAMERA_PERMISSION"
            ? "Allow camera access for Hisaabsathi Connector in Settings, then try again."
            : errorMessage(error, "Could not open the camera. Please try again."),
        title: "Photo needed",
        tone: "danger",
      });
    }
  }, [dialog, finish]);

  const capture = useCallback(() => {
    settle.current?.(null);
    const result = new Promise<string | null>((resolve) => {
      settle.current = resolve;
    });
    void shoot();
    return result;
  }, [shoot]);

  const modal = (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={() => finish(null)}
      statusBarTranslucent
      visible={uri !== null}
    >
      {uri ? (
        <PhotoConfirm
          onConfirm={() => finish(uri)}
          onRetake={() => {
            setUri(null);
            void shoot();
          }}
          uri={uri}
        />
      ) : null}
    </Modal>
  );

  return { capture, modal };
}
