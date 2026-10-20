import { useEffect, useState } from "react";

import { type AuthOrganization, authApi } from "@/lib/api/auth";

/**
 * The companies the user can work in, as the sign-in picker lists them: every one they own, and
 * one per other owner (with its synced copies in `linkedOrganizations`). Empty until loaded or if
 * the request fails.
 */
export function useMemberships(token: string | null) {
  const [organizations, setOrganizations] = useState<AuthOrganization[]>([]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi
      .listOrganizations(token)
      .then((list) => {
        if (active) setOrganizations(list);
      })
      // Without the list the profile shows the active company only, and nothing to switch to.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);
  return organizations;
}
