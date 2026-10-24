import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { fetchViewer, type Viewer } from "@/lib/api/viewer";
import { useAuthSession } from "@/lib/auth/session";
import { onReconnect } from "@/lib/network/connectivity";
import { readCache, writeCache } from "@/lib/offline/cache";
import { retryOnce } from "@/lib/retry";

const VIEWER_CACHE = "viewer";
/**
 * The app's tabs, granted per role on the web's Role Permissions (Connect App). The menus alone
 * decide which tabs show; Home and Profile always do. A shown tab whose screen lacks the backend
 * access it uses says so instead of loading (the `can…` flags).
 */
const APP_MENU = {
  attendance: "connect.attendance",
  orders: "connect.orders",
  pickups: "connect.pickups",
  sheet: "connect.sheet",
} as const;

export type AppTab = keyof typeof APP_MENU;

type ViewerState = {
  viewer: Viewer | null;
  /** The tabs the role's Connect App menus show. */
  tabs: Record<AppTab, boolean>;
  /** False until the first answer (or failure); role-gated screens wait for it. */
  isLoaded: boolean;
  /**
   * Delivery work: the Orders menu with order edit. It brings the Orders tab, the day's
   * deliveries on Home, and updating an order, for any role granted them.
   */
  canUpdateOrders: boolean;
  /**
   * The role grants order view (GET or GET_ALL): every live delivery trip in the organisation
   * shows on Home. Any role with it, including ones created later.
   */
  canViewOrders: boolean;
  /**
   * The Pickups menu with pickup view: the role's own, or as a delivery boy in an organization
   * with Pickups on. Only a delivery boy's assigned pickups list there.
   */
  canViewPickups: boolean;
  /**
   * The Sheet menu, and any same-owner organization grants the member Smart Sheets (the app's or
   * the web's Sheet menu, and order GET_ALL): the Sheet tab, listing every such organization's
   * sheets without switching. Whether each lists all sheets or only the member's own is decided
   * by the server.
   */
  canViewSheets: boolean;
  /** The Attendance menu with attendance view: the Attendance tab and the day's record on Home. */
  canViewAttendance: boolean;
  /** The Attendance menu with attendance create: the check-in / check-out swipe. */
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
  // Back online, or back from another app (say, the web after a role change): a role changed
  // meanwhile applies without reopening the app.
  useEffect(() => onReconnect(() => void reload()), [reload]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => subscription.remove();
  }, [reload]);

  const value = useMemo(() => {
    const menus = new Set(viewer?.menus ?? []);
    const orderActions = viewer?.orderActions ?? [];
    const attendanceActions = viewer?.attendanceActions ?? [];
    const tabs: Record<AppTab, boolean> = {
      // Until the role is known, Attendance shows as before; most roles have it.
      attendance: viewer ? menus.has(APP_MENU.attendance) : true,
      orders: menus.has(APP_MENU.orders),
      pickups: menus.has(APP_MENU.pickups),
      sheet: menus.has(APP_MENU.sheet),
    };
    const canSeeAttendance = menus.has(APP_MENU.attendance);
    return {
      // Until the role is known, attendance shows as before; most roles have it, and the server
      // turns away a check-in the role doesn't allow.
      canCheckIn: viewer ? canSeeAttendance && attendanceActions.includes("CREATE") : true,
      canViewAttendance: viewer
        ? canSeeAttendance &&
          attendanceActions.some((action) => action === "GET" || action === "GET_ALL")
        : true,
      canUpdateOrders: menus.has(APP_MENU.orders) && orderActions.includes("UPDATE"),
      canViewOrders: orderActions.some((action) => action === "GET" || action === "GET_ALL"),
      canViewPickups:
        menus.has(APP_MENU.pickups) &&
        ((viewer?.canViewPickups ?? false) || (viewer?.pickupActions?.includes("GET") ?? false)),
      // Without the server's answer, the role's order access decides.
      canViewSheets:
        menus.has(APP_MENU.sheet) && (viewer?.sheetsAvailable ?? orderActions.includes("GET_ALL")),
      isLoaded,
      reload,
      tabs,
      viewer,
    };
  }, [isLoaded, reload, viewer]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const context = useContext(ViewerContext);
  if (!context) throw new Error("useViewer must be used inside ViewerProvider");
  return context;
}
