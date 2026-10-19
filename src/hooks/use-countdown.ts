import { useCallback, useEffect, useState } from "react";

/** Whole seconds left until a deadline set with `start(ms)`; 0 when idle or elapsed. */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [endsAt]);

  const start = useCallback((durationMs: number) => {
    const startedAt = Date.now();
    setNow(startedAt);
    setEndsAt(startedAt + durationMs);
  }, []);

  return { seconds: Math.max(0, Math.ceil((endsAt - now) / 1000)), start };
}
