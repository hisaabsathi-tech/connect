import { isNetworkError } from "@/lib/api/network";

/**
 * Runs `load`, and once more after a short pause if it fails. The page opens with several reads
 * at once, and each makes the server first close overdue sessions, so one can fail on a clash
 * that a second try gets past.
 */
export async function retryOnce<T>(load: () => Promise<T>, pauseMs = 800): Promise<T> {
  try {
    return await load();
  } catch (error) {
    // Offline, a second try would only wait out another timeout.
    if (isNetworkError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    return load();
  }
}
