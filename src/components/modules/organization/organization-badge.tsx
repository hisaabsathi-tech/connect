import { Building03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { View } from "react-native";

import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";

// Pulled out over a card's 16pt padding, so the tag sits flush in its corner.
const CORNERS = {
  "top-left": "-ml-4 -mt-4 mb-3 max-w-[80%]",
  "top-right": "-mr-4 -mt-4 max-w-[45%]",
} as const;

/**
 * The organization a card's record belongs to, as a tag flush in the card's corner, for a list
 * that holds more than one organization's records. Top-right sits in the card's first row (a
 * long title wraps beside it); top-left sits above the card's content, where the first row's
 * corner already holds a status.
 */
export function OrganizationBadge({
  corner = "top-left",
  name,
}: {
  corner?: keyof typeof CORNERS;
  name: string;
}) {
  return (
    <View
      accessibilityLabel={`Organization ${name}`}
      className={`${CORNERS[corner]} flex-row items-center gap-1 self-start bg-accent px-2 py-1`}
    >
      <HugeiconsIcon color={colors.primary} icon={Building03Icon} size={12} />
      <Text className="shrink text-[11px] font-medium text-primary" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
