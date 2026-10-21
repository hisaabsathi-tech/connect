import { useCallback, useEffect, useState } from "react";

import { useNetwork } from "@/components/modules/network";
import { useToast } from "@/components/ui/toast";
import { uploadProfilePhoto } from "@/lib/api/media";
import { isNetworkError } from "@/lib/api/network";
import { fetchProfile, type Profile, patchProfile } from "@/lib/api/profile";
import { errorMessage } from "@/lib/errors";
import { readCache, writeCache } from "@/lib/offline/cache";

const PROFILE_CACHE = "profile";

/** The signed-in person's profile, loaded on mount and again on pull to refresh. */
export function useProfile(token: string | null) {
  const toast = useToast();
  const { requireOnline } = useNetwork();
  // The profile saved last time shows at once, and offline.
  const [profile, setProfile] = useState<Profile | null>(
    () => readCache<Profile>(PROFILE_CACHE, "me")?.data ?? null,
  );
  const [loading, setLoading] = useState(() => profile === null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await fetchProfile(token);
      setProfile(next);
      writeCache(PROFILE_CACHE, "me", next);
    } catch (error) {
      // Offline the saved profile stays up; the Offline chip says why.
      if (!isNetworkError(error)) {
        toast.error("Could not load profile", errorMessage(error, "Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const save = useCallback(
    async (input: Pick<Profile, "address" | "phoneNumber">) => {
      if (!token || saving || !requireOnline("Updating your profile")) return false;
      setSaving(true);
      try {
        const updated = await patchProfile(token, input);
        setProfile((current) => (current ? { ...current, ...updated } : current));
        toast.success("Profile updated");
        return true;
      } catch (error) {
        toast.error("Could not update profile", errorMessage(error, "Please try again."));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [requireOnline, saving, toast, token],
  );

  /** Uploads a cropped photo and makes it the profile image. Resolves true once saved. */
  const savePhoto = useCallback(
    async (uri: string) => {
      if (!token || !requireOnline("Changing your photo")) return false;
      try {
        const uploaded = await uploadProfilePhoto(token, uri);
        await patchProfile(token, { image: uploaded.objectKey });
        // The presigned view URL shows the new photo at once; a reload resolves it again.
        const image = uploaded.viewUrl ?? uri;
        setProfile((current) => (current ? { ...current, image } : current));
        toast.success("Profile photo updated");
        return true;
      } catch (error) {
        toast.error("Could not update photo", errorMessage(error, "Please try again."));
        return false;
      }
    },
    [requireOnline, toast, token],
  );

  return { loading, profile, refresh, refreshing, save, savePhoto, saving };
}
