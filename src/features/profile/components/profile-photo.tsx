import { Camera01Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useCallback, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import ImageCropPicker from "react-native-image-crop-picker";

import { useDialog } from "@/components/modules/dialog";
import { PhotoConfirm } from "@/components/modules/photo";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";

type Source = "camera" | "gallery";

// The picker resizes the square crop to this many pixels a side and saves a compressed JPEG,
// so a profile photo uploads as a few tens of kilobytes.
const PHOTO_SIZE = 512;

const PERMISSION_ERRORS: Record<string, string> = {
  E_NO_CAMERA_PERMISSION:
    "Allow camera access for Hisaab Sathi Connect in Settings, then try again.",
  E_NO_LIBRARY_PERMISSION:
    "Allow photo access for Hisaab Sathi Connect in Settings, then try again.",
};

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

/**
 * Camera or gallery, then the native square cropper with only the crop box (pinch and drag;
 * no zoom slider, rotate or scale panel). Returns the cropped JPEG as a `file://` URI, or null
 * when cancelled. The gallery uses Android's photo picker, which needs no storage permission.
 */
async function pickPhoto(source: Source): Promise<string | null> {
  const options = {
    compressImageQuality: 0.8,
    cropperActiveWidgetColor: colors.primary,
    cropperCancelText: "Cancel",
    cropperChooseText: "Done",
    cropperToolbarTitle: "Crop photo",
    cropping: true,
    enableRotationGesture: false,
    forceJpg: true,
    height: PHOTO_SIZE,
    hideBottomControls: true,
    mediaType: "photo" as const,
    showCropGuidelines: true,
    width: PHOTO_SIZE,
  };
  try {
    const image =
      source === "camera"
        ? await ImageCropPicker.openCamera({ ...options, useFrontCamera: true })
        : await ImageCropPicker.openPicker(options);
    return image.path.startsWith("file://") ? image.path : `file://${image.path}`;
  } catch (error) {
    if (errorCode(error) === "E_PICKER_CANCELLED") return null;
    throw error;
  }
}

function SourceButton({
  icon,
  label,
  onPress,
}: {
  icon: typeof Camera01Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-14 flex-row items-center justify-center gap-3 bg-[#CDD4FF] active:opacity-80"
      onPress={onPress}
    >
      <HugeiconsIcon color={colors.foreground} icon={icon} size={24} strokeWidth={1.6} />
      <Text className="text-base font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}

/**
 * Change the profile photo: a sheet offers Camera or Gallery, the photo is cropped square, then
 * the full-screen Retake / Confirm page (the same one attendance photos use) uploads it.
 * `onSave` resolves true once the photo is the profile image. Render `element` once.
 */
export function useProfilePhoto(onSave: (uri: string) => Promise<boolean>) {
  const dialog = useDialog();
  const [choosing, setChoosing] = useState(false);
  const [source, setSource] = useState<Source>("camera");
  const [uri, setUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async (next: Source) => {
    try {
      return await pickPhoto(next);
    } catch (error) {
      void dialog.alert({
        description:
          PERMISSION_ERRORS[errorCode(error)] ??
          errorMessage(error, "Could not open the photo. Please try again."),
        title: next === "camera" ? "Camera unavailable" : "Gallery unavailable",
        tone: "danger",
      });
      return null;
    }
  };

  const choose = async (next: Source) => {
    haptic("light");
    setSource(next);
    const picked = await pick(next);
    if (!picked) return;
    setChoosing(false);
    setUri(picked);
  };

  // A retake that is cancelled keeps the current photo on screen.
  const retake = async () => {
    const picked = await pick(source);
    if (picked) setUri(picked);
  };

  const discard = () => {
    setUri(null);
    void ImageCropPicker.clean().catch(() => undefined);
  };

  const confirm = async () => {
    if (!uri) return;
    setSaving(true);
    const saved = await onSave(uri);
    setSaving(false);
    if (saved) discard();
  };

  const open = useCallback(() => setChoosing(true), []);

  const element = (
    <>
      <BottomSheet onClose={() => setChoosing(false)} visible={choosing}>
        <Text className="mt-5 text-xl font-semibold text-foreground">Choose photo</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Capture or upload your photo</Text>
        <View className="mt-5 gap-3">
          <SourceButton icon={Camera01Icon} label="Camera" onPress={() => void choose("camera")} />
          <SourceButton icon={Image01Icon} label="Gallery" onPress={() => void choose("gallery")} />
        </View>
        <Pressable
          accessibilityRole="button"
          className="mt-2 py-3"
          onPress={() => setChoosing(false)}
        >
          <Text className="text-center text-base text-muted-foreground">Cancel</Text>
        </Pressable>
      </BottomSheet>
      <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={() => {
          if (!saving) discard();
        }}
        statusBarTranslucent
        visible={uri !== null}
      >
        {uri ? (
          <PhotoConfirm
            busy={saving}
            onConfirm={() => void confirm()}
            onRetake={() => void retake()}
            uri={uri}
          />
        ) : null}
      </Modal>
    </>
  );

  return { element, open };
}
