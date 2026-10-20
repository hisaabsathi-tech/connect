import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { fetchDrs } from "@/lib/api/drs";
import { useAuthSession } from "@/lib/auth/session";
import { useViewer } from "@/lib/auth/viewer";
import { errorMessage } from "@/lib/errors";

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
 * Prints a DRS the way the web app does (the classic A4 template): the PDF is made on the phone,
 * then Android's print screen opens on it with its preview, paper size, printers and Save as PDF
 * (offering `DRS-<id>.pdf`). `printing` is the id of the sheet being made.
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
        const [Print, { File, Paths }] = await Promise.all([
          import("expo-print"),
          import("expo-file-system"),
        ]);
        const { uri } = await Print.printToFileAsync({ height: A4.height, html, width: A4.width });
        // The print screen names the job (and the Save as PDF file) after the file it prints.
        const named = new File(Paths.cache, `DRS-${sheet.id}.pdf`);
        if (named.exists) named.delete();
        await new File(uri).move(named);
        await Print.printAsync({ uri: named.uri });
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
