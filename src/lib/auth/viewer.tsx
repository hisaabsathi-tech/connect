import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { fetchViewer, type Viewer } from "@/lib/api/viewer";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";
import { retryOnce } from "@/lib/retry";

const VIEWER_CACHE = "viewer";

type ViewerState = {
  viewer: Viewer | null;
  /** False until the first answer (or failure); role-gated screens wait for it. */
  isLoaded: boolean;
  /**
   * The role grants order edit: the Orders tab, the day's deliveries on Home, and updating an
   * order. Any role with it gets them, not only the delivery boy role.
   */
  canUpdateOrders: boolean;
  /**
   * The role grants order view (GET or GET_ALL): every live delivery trip in the organisation
   * shows on Home. Any role with it, including ones created later.
   */
  canViewOrders: boolean;
  /** An enabled same-owner organization grants this delivery boy Pickup access. */
  canViewPickups: boolean;
  /** The role grants attendance view: the Attendance tab and the day's record on Home. */
  canViewAttendance: boolean;
  /** The role grants attendance create: the check-in / check-out swipe. */
  canCheckIn: boolean;
  reload: () => Promise<void>;
};

const ViewerContext = createContext<ViewerState | null>(null);

/**
 * The signed-in member's name, role and organisation, loaded once per session. Mounted inside the
 * tabs, which start over when the organisation changes, so a switch loads the new role.
 */
export function ViewerProvider({ children }: PropsWithChildren) {
  const { token } = useAuthSession();
  // The role saved last time: offline (or before the answer) the tabs keep their access.
  const [viewer, setViewer] = useState<Viewer | null>(
    () => readCache<Viewer>(VIEWER_CACHE, "me")?.data ?? null,
  );
  const [isLoaded, setLoaded] = useState(() => viewer !== null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const next = await retryOnce(() => fetchViewer(token));
      setViewer(next);
      writeCache(VIEWER_CACHE, "me", next);
    } catch {
      // Keeps what was loaded (or saved); without it the role-gated tabs stay hidden.
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);
  // Back online: a role changed meanwhile applies without reopening the app.
  useEffect(() => onReconnect(() => void reload()), [reload]);

  const value = useMemo(
    () => ({
      // Until the role is known, attendance shows as before; most roles have it, and the server
      // turns away a check-in the role doesn't allow.
      canCheckIn: viewer ? viewer.attendanceActions.includes("CREATE") : true,
      canViewAttendance: viewer
        ? viewer.attendanceActions.some((action) => action === "GET" || action === "GET_ALL")
        : true,
      canUpdateOrders: viewer?.orderActions.includes("UPDATE") ?? false,
      canViewOrders:
        viewer?.orderActions.some((action) => action === "GET" || action === "GET_ALL") ?? false,
      canViewPickups: viewer?.canViewPickups ?? false,
      isLoaded,
      reload,
      viewer,
    }),
    [isLoaded, reload, viewer],
  );
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const context = useContext(ViewerContext);
  if (!context) throw new Error("useViewer must be used inside ViewerProvider");
  return context;
}
