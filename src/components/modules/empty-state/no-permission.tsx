import { TabScreen } from "@/components/modules/layout";

import { EmptyBlock } from "./empty-block";

/**
 * A tab the role is given (its Connect App menu) without the access its screen needs: the tab
 * stays, and says what is missing instead of loading.
 */
export function NoPermission({ description }: { description: string }) {
  return (
    <TabScreen>
      <EmptyBlock
        description={`${description} Ask your admin to allow it in Role Permissions.`}
        title="No permission"
      />
    </TabScreen>
  );
}
