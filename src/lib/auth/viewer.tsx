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

// The server's delivery boy role slug (spelt "delhivery" there) and the spellings it also accepts.
const DELIVERY_BOY_SLUGS = new Set([
  "delhivery-boy",
  "delivery-boy",
  "delhiveryboy",
  "deliveryboy",
]);

/** True for any of the slugs the server treats as the delivery boy role. */
export function isDeliveryBoyRoleSlug(slug: string | null | undefined) {
  const normalized = slug
    ?.trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return Boolean(normalized && DELIVERY_BOY_SLUGS.has(normalized));
}

type ViewerState = {
  viewer: Viewer | null;
  /** False until the first answer (or failure); role-gated screens wait for it. */
  isLoaded: boolean;
  isDeliveryBoy: boolean;
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
      isDeliveryBoy: isDeliveryBoyRoleSlug(viewer?.roleSlug),
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
