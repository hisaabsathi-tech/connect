import { useCallback, useEffect, useState } from "react";

import { fetchSheetOrganizations, type SheetOrganization } from "@/lib/api/smart-sheets";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";

const ORGANIZATIONS_CACHE = "sheet-organizations";

/**
 * The organizations whose sheets the member may read, by name, for the Sheet pages' organization
 * pickers. Opens with the list saved last time (offline too) while a fresh one loads; empty until
 * the first answer.
 */
export function useSheetOrganizations() {
  const { token } = useAuthSession();
  const [organizations, setOrganizations] = useState<SheetOrganization[]>(
    () => readCache<SheetOrganization[]>(ORGANIZATIONS_CACHE, "list")?.data ?? [],
  );
  const [loaded, setLoaded] = useState(() => organizations.length > 0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await fetchSheetOrganizations(token);
      writeCache(ORGANIZATIONS_CACHE, "list", fresh, 1);
      setOrganizations(fresh);
    } catch {
      // Keeps the saved list; the pickers just hide without one.
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onReconnect(() => void load()), [load]);

  return { loaded, organizations };
}
