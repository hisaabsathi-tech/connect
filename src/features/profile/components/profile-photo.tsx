import { usePhotoPicker } from "@/components/modules/photo";

/**
 * Change the profile photo: Camera or Gallery, cropped square (front camera first), then the
 * Retake / Confirm page. `onSave` resolves true once the photo is the profile image. Render
 * `element` once.
 */
export function useProfilePhoto(onSave: (uri: string) => Promise<boolean>) {
  return usePhotoPicker(onSave, {
    crop: "square",
    description: "Capture or upload your photo",
    frontCamera: true,
    title: "Choose photo",
  });
}
