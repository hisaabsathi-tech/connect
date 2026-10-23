import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect } from "react";

const checkInSource = require("@/assets/audio/checkin.m4a");
const checkOutSource = require("@/assets/audio/checkout.m4a");

/**
 * Short confirmation sounds for a saved check-in or check-out. They mix with whatever else is
 * playing instead of pausing it, and stay quiet when the phone is on silent or vibrate.
 */
export function useAttendanceSounds() {
  const checkIn = useAudioPlayer(checkInSource);
  const checkOut = useAudioPlayer(checkOutSource);

  useEffect(() => {
    void setAudioModeAsync({ interruptionMode: "mixWithOthers", playsInSilentMode: false });
  }, []);

  return useCallback(
    (kind: "in" | "out") => {
      const player = kind === "in" ? checkIn : checkOut;
      // A player stays at the end after playing once; rewind so every check-in sounds.
      void player.seekTo(0);
      player.play();
    },
    [checkIn, checkOut],
  );
}
