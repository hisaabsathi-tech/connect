import { useCallback, useState } from "react";

import { PhotoDialog } from "@/components/modules/photo";
import { fetchViewUrl } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";

/**
 * The photo sent with an order's Confirm Delivery. `open` signs its storage key afresh (a saved
 * link would have expired) and shows it in the photo dialog. Render `element` once.
 */
export function usePodPhoto() {
  const { token } = useAuthSession();
  const [title, setTitle] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (storageKey: string, awbNo: string) => {
      if (!token) return;
      setTitle(`AWB ${awbNo}`);
      setUri(null);
      setError(null);
      try {
        setUri(await fetchViewUrl(token, storageKey));
      } catch {
        setError("The delivery photo could not be loaded. Check your internet and try again.");
      }
    },
    [token],
  );

  const element = (
    <PhotoDialog
      error={error}
      onClose={() => setTitle(null)}
      title={title ?? "Delivery photo"}
      uri={uri}
      visible={title !== null}
    />
  );

  return { element, open };
}
