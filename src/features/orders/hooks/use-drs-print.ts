import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { fetchDrs } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { errorMessage } from "@/lib/errors";
import { saveToDevice, shareFile } from "@/lib/files/device-files";

import { A4, type DrsPrintAssets, drsHtml } from "../lib/drs-print/drs-html";
import { drsPrintData } from "../lib/drs-print/template-data";

// The Hisaab Sathi mark (669×144) the web template prints when there is no uploaded logo.
const FALLBACK_LOGO_RATIO = 669 / 144;

/** A bundled file's contents (base64, or text for the SVG); null if it can't be read. */
async function readAsset(module: number, as: "base64" | "text") {
  try {
    const [{ Asset }, { File }] = await Promise.all([
      import("expo-asset"),
      import("expo-file-system"),
    ]);
    const asset = await Asset.fromModule(module).downloadAsync();
    if (!asset.localUri) return null;
    const file = new File(asset.localUri);
    return as === "base64" ? await file.base64() : await file.text();
  } catch {
    return null;
  }
}

// Fonts and the fallback mark don't change; they are read once per app run.
let bundled: Promise<Omit<DrsPrintAssets, "logo" | "fallbackLogoRatio"> & { mark: string | null }>;

function bundledAssets() {
  bundled ??= Promise.all([
    readAsset(require("@/assets/fonts/satoshi-regular.otf"), "base64"),
    readAsset(require("@/assets/fonts/satoshi-medium.otf"), "base64"),
    readAsset(require("@/assets/logo/dark.svg"), "text"),
  ]).then(([regular, medium, mark]) => ({
    fontMedium: medium && `data:font/otf;base64,${medium}`,
    fontRegular: regular && `data:font/otf;base64,${regular}`,
    mark: mark && `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mark)}`,
  }));
  return bundled;
}

/** The organisation's logo as a data URI, so the page doesn't wait on the network to draw it. */
async function inlineImage(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.blob();
    });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Prints a DRS the way the web app does (the classic A4 template), as a PDF saved on the phone:
 * into the export folder (picked once, like the attendance download), then the share sheet to
 * print or send it. `printing` is the id of the sheet being made.
 */
export function useDrsPrint() {
  const { token } = useAuthSession();
  const { viewer } = useViewer();
  const toast = useToast();
  const [printing, setPrinting] = useState<string | null>(null);

  const print = useCallback(
    async (id: string) => {
      if (!token || printing) return;
      setPrinting(id);
      try {
        const organization = viewer?.organization ?? null;
        const [sheet, assets, logo] = await Promise.all([
          fetchDrs(token, id),
          bundledAssets(),
          organization?.logo ? inlineImage(organization.logo) : Promise.resolve(null),
        ]);
        const html = drsHtml(drsPrintData(sheet, organization, viewer?.name ?? ""), {
          fallbackLogoRatio: logo ? null : FALLBACK_LOGO_RATIO,
          fontMedium: assets.fontMedium,
          fontRegular: assets.fontRegular,
          logo: logo ?? assets.mark,
        });
        const Print = await import("expo-print");
        const { base64 } = await Print.printToFileAsync({
          base64: true,
          height: A4.height,
          html,
          width: A4.width,
        });
        if (!base64) throw new Error("The PDF could not be made.");
        const file = {
          contents: base64,
          encoding: "base64" as const,
          mimeType: "application/pdf",
          name: `DRS-${sheet.id}.pdf`,
        };
        const folder = await saveToDevice([file]);
        if (folder) toast.success("DRS downloaded", `Saved to ${folder} on your device.`);
        await shareFile(file, `DRS ${sheet.id}`);
      } catch (error) {
        toast.error("Couldn't print the DRS", errorMessage(error, "Please try again."));
      } finally {
        setPrinting(null);
      }
    },
    [printing, toast, token, viewer],
  );

  return { print, printing };
}
