import { Text } from "@/components/modules/typography";
import { formatTime } from "@/lib/date";

/** "Last updated 10:42 · offline" under data shown from the phone's saved copy. */
export function LastUpdated({ at }: { at: number | null }) {
  if (at == null) return null;
  return (
    <Text className="mt-2 text-xs text-muted-foreground">
      Last updated {formatTime(new Date(at).toISOString())} · offline
    </Text>
  );
}
