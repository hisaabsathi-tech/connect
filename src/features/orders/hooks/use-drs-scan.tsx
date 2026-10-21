import { useCallback, useRef, useState } from "react";

import { PhotoDialog, usePhotoPicker } from "@/components/modules/photo";
import { useToast } from "@/components/ui/toast";
import { type DrsSheet, fetchViewUrl, patchDrs } from "@/lib/api/drs";
import { uploadDrsScan } from "@/lib/api/media";
import { isNetworkError } from "@/lib/api/network";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { isOnline } from "@/lib/network/connectivity";
import { enqueue } from "@/lib/offline/outbox";

/**
 * The scan of a signed DRS. `open` uploads one when the sheet has none (camera or gallery, a
 * free-shape crop, then Retake / Confirm) and otherwise shows it, with Re Upload to replace it.
 * The sheet the server returns goes to `onUpdated`. Render `element` once.
 */
export function useDrsScan(onUpdated: (sheet: DrsSheet) => void) {
  const { token } = useAuthSession();
  const toast = useToast();
  // The sheet the picker is uploading for; the picker's save callback reads it.
  const target = useRef<DrsSheet | null>(null);
  const [viewing, setViewing] = useState<DrsSheet | null>(null);
  const [viewUri, setViewUri] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const save = async (uri: string) => {
    const sheet = target.current;
    if (!(token && sheet)) return false;
    // Offline the scan is kept on the phone and attached once the app is back online.
    const queue = () => {
      enqueue({
        drsId: sheet.id,
        kind: "drs-scan",
        label: `DRS ${sheet.id} · Signed scan`,
        photo: uri,
      });
      toast.success("Scan saved offline", `It will be attached to ${sheet.id} once you're online.`);
      return true;
    };
    if (!isOnline()) return queue();
    try {
      const { objectKey } = await uploadDrsScan(token, uri);
      const updated = await patchDrs(token, sheet.id, { scanCopy: objectKey });
      toast.success("Scan uploaded", `The signed sheet is attached to ${sheet.id}.`);
      onUpdated(updated);
      return true;
    } catch (error) {
      if (isNetworkError(error)) return queue();
      toast.error("Couldn't upload the scan", errorMessage(error, "Please try again."));
      return false;
    }
  };

  const picker = usePhotoPicker(save, {
    crop: "free",
    description: "Capture or upload the signed DRS sheet",
    title: "Upload DRS scan",
  });

  const upload = useCallback(
    (sheet: DrsSheet) => {
      target.current = sheet;
      picker.open();
    },
    [picker.open],
  );

  const view = useCallback(
    async (sheet: DrsSheet) => {
      if (!(token && sheet.scanCopy)) return;
      setViewing(sheet);
      setViewUri(null);
      setViewError(null);
      try {
        setViewUri(await fetchViewUrl(token, sheet.scanCopy));
      } catch (error) {
        setViewError(errorMessage(error, "The scan could not be loaded."));
      }
    },
    [token],
  );

  const open = useCallback(
    (sheet: DrsSheet) => (sheet.scanCopy ? void view(sheet) : upload(sheet)),
    [upload, view],
  );

  const element = (
    <>
      {picker.element}
      <PhotoDialog
        action={
          viewing
            ? {
                label: "Re Upload",
                onPress: () => {
                  const sheet = viewing;
                  setViewing(null);
                  upload(sheet);
                },
              }
            : undefined
        }
        error={viewError}
        onClose={() => setViewing(null)}
        title={viewing ? `DRS ${viewing.id}` : "DRS scan"}
        uri={viewUri}
        visible={viewing !== null}
      />
    </>
  );

  return { element, open };
}
