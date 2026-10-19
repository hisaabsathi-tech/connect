import { router } from "expo-router";

import { EmptyState } from "@/components/modules/empty-state";
import { TabScreen } from "@/components/modules/layout";

export function ProfileScreen() {
  return (
    <TabScreen>
      <EmptyState
        action={{ label: "Home", onPress: () => router.navigate("/") }}
        description={["Your profile will appear here."]}
        title="Profile"
      />
    </TabScreen>
  );
}
