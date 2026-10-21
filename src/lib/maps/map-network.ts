import { NetworkManager, OfflineManager } from "@maplibre/maplibre-react-native";

import { onConnectivityChange } from "@/lib/network/connectivity";

// Map tiles already seen are kept on the phone up to this size, so those streets still draw
// offline (the default cache is far smaller).
const AMBIENT_CACHE_BYTES = 150 * 1024 * 1024;

let started = false;

/**
 * Keeps the maps in step with the connection: offline they stop retrying tile downloads and draw
 * from the saved tiles; back online they load again.
 */
export function startMapNetwork() {
  if (started) return;
  started = true;
  void OfflineManager.setMaximumAmbientCacheSize(AMBIENT_CACHE_BYTES).catch(() => undefined);
  onConnectivityChange((status) => {
    try {
      NetworkManager.setConnected(status !== "offline");
    } catch {
      // The native map module isn't loaded yet; the next change applies.
    }
  });
}
