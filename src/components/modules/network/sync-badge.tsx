import { RemarkBadge } from "@/components/modules/remark-badge";
import { pendingFor, useOutbox } from "@/lib/offline/outbox";

/**
 * On an order, pickup or sheet updated offline: "Waiting to sync" until the server has it, or
 * "Needs attention" when the server refused it. Nothing otherwise.
 */
export function SyncBadge({ id }: { id: string }) {
  const held = pendingFor(useOutbox().items, id);
  if (!held.length) return null;
  return held.some((item) => item.state === "failed") ? (
    <RemarkBadge label="Needs attention" variant="destructive" />
  ) : (
    <RemarkBadge label="Waiting to sync" variant="transit" />
  );
}
