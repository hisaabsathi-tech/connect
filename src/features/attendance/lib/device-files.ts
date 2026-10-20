import * as SecureStore from "expo-secure-store";

// Where the folder picker opens the first time: Android's Download folder.
const DOWNLOADS_URI = "content://com.android.externalstorage.documents/document/primary%3ADownload";
// The folder the member picked for exports; Android keeps the app's access to it.
const EXPORT_FOLDER_KEY = "hisaabsathi.connector.export-folder";

export type ExportFile = {
  name: string;
  mimeType: string;
  contents: string;
  /** `base64` for binary files such as a PNG. */
  encoding?: "base64" | "utf8";
};

/**
 * Saves files straight into a folder on the device, without needing the share sheet. The first
 * time (or if access to the folder was lost) the system folder picker opens at Download for the
 * member to choose one; later exports save there without asking. Resolves to the folder's name,
 * or null when the member backed out of choosing one.
 *
 * The file modules load on demand, so a build without them only fails here, not on opening the
 * tab.
 */
export async function saveToDevice(files: ExportFile[]): Promise<string | null> {
  const { Directory } = await import("expo-file-system");
  // Android names a repeat "… (1).png" rather than overwriting.
  const write = (folder: InstanceType<typeof Directory>) => {
    for (const file of files)
      folder
        .createFile(file.name, file.mimeType)
        .write(file.contents, { encoding: file.encoding ?? "utf8" });
    return folder.name || "your folder";
  };
  const saved = await SecureStore.getItemAsync(EXPORT_FOLDER_KEY).catch(() => null);
  if (saved) {
    try {
      return write(new Directory(saved));
    } catch {
      // Access was revoked or the folder is gone: ask for one again.
      await SecureStore.deleteItemAsync(EXPORT_FOLDER_KEY).catch(() => undefined);
    }
  }
  let folder: InstanceType<typeof Directory>;
  try {
    folder = await Directory.pickDirectoryAsync(DOWNLOADS_URI);
  } catch {
    return null;
  }
  await SecureStore.setItemAsync(EXPORT_FOLDER_KEY, folder.uri).catch(() => undefined);
  return write(folder);
}

/** Writes one file to the cache and opens the share sheet (email, chat, Drive). */
export async function shareFile(file: ExportFile, dialogTitle: string) {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import("expo-file-system"),
    import("expo-sharing"),
  ]);
  const cached = new File(Paths.cache, file.name);
  cached.create({ overwrite: true });
  cached.write(file.contents, { encoding: file.encoding ?? "utf8" });
  await Sharing.shareAsync(cached.uri, { dialogTitle, mimeType: file.mimeType });
}
