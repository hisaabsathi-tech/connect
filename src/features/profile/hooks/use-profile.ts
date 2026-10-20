import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { fetchProfile, type Profile, patchProfile } from "@/lib/api/profile";
import { errorMessage } from "@/lib/errors";

/** The signed-in person's profile, loaded on mount and again on pull to refresh. */
export function useProfile(token: string | null) {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setProfile(await fetchProfile(token));
    } catch (error) {
      toast.error("Could not load profile", errorMessage(error, "Please try again."));
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
      if (!token || saving) return false;
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
    [saving, toast, token],
  );

  return { loading, profile, refresh, refreshing, save, saving };
}
