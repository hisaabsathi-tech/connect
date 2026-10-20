import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable } from "react-native";

import { useDialog } from "@/components/modules/dialog";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { useAuthSession } from "@/lib/auth/session";
import { haptic } from "@/lib/haptics";

/** Asks in a bottom sheet first; signs out once the sheet has slid away. */
export function LogoutButton() {
  const { signOut } = useAuthSession();
  const dialog = useDialog();

  const confirmSignOut = async () => {
    haptic("light");
    const confirmed = await dialog.confirm({
      confirmLabel: "Log out",
      description: "You will need to sign in again to use Connector.",
      title: "Log out?",
      tone: "danger",
    });
    if (confirmed) void signOut();
  };

  return (
    <Pressable
      accessibilityRole="button"
      className="mt-3 flex-row items-center justify-center gap-2 bg-destructive/10 py-3"
      onPress={confirmSignOut}
    >
      <Text className="text-base font-medium text-destructive">Logout</Text>
      <HugeiconsIcon color={colors.destructive} icon={Logout01Icon} size={20} />
    </Pressable>
  );
}
