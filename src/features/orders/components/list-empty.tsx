import { InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

/**
 * What the list shows when it has nothing: centred in the space left under the page's header,
 * the inbox mark with a title and a line of help (and an action, such as Try again). Without a
 * title it is the loading spinner, in the same place.
 */
export function ListEmpty({
  action,
  description,
  title,
}: {
  action?: { label: string; onPress: () => void };
  description?: string;
  title?: string;
}) {
  return (
    <View className="min-h-64 flex-1 items-center justify-center px-6 py-10">
      {title ? (
        <>
          <View className="h-14 w-14 items-center justify-center bg-[#F5F6F8]">
            <HugeiconsIcon color={colors.foreground} icon={InboxIcon} size={30} strokeWidth={1.6} />
          </View>
          <Text className="mt-5 text-center text-lg font-medium text-foreground">{title}</Text>
          {description ? (
            <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
              {description}
            </Text>
          ) : null}
          {action ? (
            <Pressable
              accessibilityRole="button"
              className="mt-5 h-10 justify-center border border-primary px-4 active:bg-accent"
              onPress={action.onPress}
            >
              <Text className="text-sm font-medium text-primary">{action.label}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Loader fullHeight={false} transparent />
      )}
    </View>
  );
}
