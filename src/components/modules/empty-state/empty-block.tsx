import { ArchiveOff04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { Pressable, useWindowDimensions, View } from "react-native";

import { CardListSkeleton } from "@/components/modules/skeleton";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

// The web app's empty-block illustration (720×686).
const ILLUSTRATION = require("@/assets/illustrations/empty-block.webp");
const ILLUSTRATION_SIZE = { height: 143, width: 150 };

/** The table's loading block takes at least this share of the screen's height. */
const SCREEN_SHARE = 0.5;

/**
 * A block for a list or table with nothing to show: the web app's empty illustration (or its
 * empty-table icon inside a table), a title, a line of help and an optional action. Without a
 * title it is loading: a list shows skeleton cards in place of the cards to come, a table a
 * loading block of the same height.
 *
 * The illustration sits directly on the page background, sized to its own content — no card
 * background, no border and no minimum height, so an empty list never forces the page to scroll.
 * It grows into the space its parent leaves (a list whose content container grows), so it sits
 * centred between the list's header and the bottom of the screen.
 * Inside a table, the empty/loading row keeps a card background and holds half the screen's
 * height, in place of the rows it stands in for.
 */
export function EmptyBlock({
  action,
  description,
  title,
  variant = "illustration",
}: {
  action?: { label: string; onPress: () => void };
  description?: string;
  title?: string;
  /** `table` uses the data table's empty icon and sits inside the table's border. */
  variant?: "illustration" | "table";
}) {
  const { height } = useWindowDimensions();
  const framed = variant === "illustration";
  if (!title && framed) return <CardListSkeleton />;
  return (
    <View
      className={`items-center justify-center px-6 py-8 ${framed ? "grow" : "bg-card"}`}
      style={framed ? undefined : { minHeight: height * SCREEN_SHARE }}
    >
      {title ? (
        <>
          {framed ? (
            <Image contentFit="contain" source={ILLUSTRATION} style={ILLUSTRATION_SIZE} />
          ) : (
            <HugeiconsIcon color={colors.foreground} icon={ArchiveOff04Icon} size={32} />
          )}
          <Text
            className={`w-full text-center font-semibold text-foreground ${framed ? "mt-5 text-lg" : "mt-3 text-base"}`}
          >
            {title}
          </Text>
          {description ? (
            <Text className="mt-1 w-full text-center text-sm text-muted-foreground">
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
