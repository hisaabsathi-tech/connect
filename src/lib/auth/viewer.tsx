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
import { retryOnce } from "@/lib/retry";

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
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isLoaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      setViewer(await retryOnce(() => fetchViewer(token)));
    } catch {
      // Keeps what was loaded; without it the role-gated tabs stay hidden.
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
