import { ArrowDown01Icon, Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { RemarkBadge } from "@/components/modules/remark-badge";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import type { DrsSheet } from "@/lib/api/drs";
import { haptic } from "@/lib/haptics";

import { drsAreas, drsBadge } from "../lib/drs";

// The list of sheets stops at this share of the screen and scrolls past it.
const LIST_SHARE = 0.55;

const areasOf = (sheet: DrsSheet) => drsAreas(sheet).join(", ") || "No areas";

function Option({
  detail,
  onPress,
  selected,
  sheet,
  title,
}: {
  detail?: string;
  onPress: () => void;
  selected: boolean;
  sheet?: DrsSheet;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 border-border border-b px-1 py-3 ${selected ? "bg-accent active:bg-accent" : "active:bg-[#F7F8FF]"}`}
      onPress={onPress}
    >
      <View className="flex-1 pl-2">
        <Text
          className={`text-base ${selected ? "font-semibold text-primary" : "font-medium text-foreground"}`}
        >
          {title}
        </Text>
        {detail ? (
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {sheet ? <RemarkBadge {...drsBadge(sheet.status)} /> : null}
      <View className="w-6 items-center pr-1">
        {selected ? <HugeiconsIcon color={colors.primary} icon={Tick02Icon} size={18} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Narrows the orders to one DRS: a field showing the chosen sheet's id and areas (or All DRS),
 * opening a sheet that lists every DRS in the date range.
 */
export function DrsPicker({
  onChange,
  sheets,
  value,
}: {
  onChange: (drsId: string | null) => void;
  sheets: DrsSheet[];
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const selected = sheets.find((sheet) => sheet.id === value) ?? null;

  const choose = (drsId: string | null) => {
    haptic("selection");
    setOpen(false);
    onChange(drsId);
  };

  return (
    <>
      <View
        className={`mt-3 min-h-12 flex-row items-center border bg-card ${selected ? "border-primary" : "border-border"}`}
      >
        <Pressable
          accessibilityLabel="Choose a DRS"
          accessibilityRole="button"
          className="flex-1 flex-row items-center gap-3 px-4 py-2"
          onPress={() => setOpen(true)}
          onPressIn={() => haptic("light")}
        >
          <View className="flex-1">
            {selected ? (
              <>
                <Text className="text-base font-medium text-foreground" numberOfLines={1}>
                  {selected.id}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {areasOf(selected)}
                </Text>
              </>
            ) : (
              <Text className="text-base text-foreground">All DRS</Text>
            )}
          </View>
          <HugeiconsIcon
            color={colors.mutedForeground}
            icon={ArrowDown01Icon}
            size={18}
            strokeWidth={1.8}
          />
        </Pressable>
        {selected ? (
          <Pressable
            accessibilityLabel="Show orders of every DRS"
            accessibilityRole="button"
            className="h-full min-h-12 w-11 items-center justify-center border-border border-l"
            onPress={() => choose(null)}
          >
            <HugeiconsIcon color={colors.mutedForeground} icon={Cancel01Icon} size={16} />
          </Pressable>
        ) : null}
      </View>
      <BottomSheet dragHandleOnly onClose={() => setOpen(false)} visible={open}>
        <Text className="mt-5 text-xl font-semibold text-foreground">Select DRS</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Show the orders of one delivery run sheet
        </Text>
        <ScrollView className="mt-4" style={{ maxHeight: height * LIST_SHARE }}>
          <Option
            detail={`${sheets.length} ${sheets.length === 1 ? "sheet" : "sheets"}`}
            onPress={() => choose(null)}
            selected={!selected}
            title="All DRS"
          />
          {sheets.map((sheet) => (
            <Option
              detail={areasOf(sheet)}
              key={sheet.id}
              onPress={() => choose(sheet.id)}
              selected={sheet.id === selected?.id}
              sheet={sheet}
              title={sheet.id}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
