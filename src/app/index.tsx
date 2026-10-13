import Constants from "expo-constants";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { HapticButton } from "@/components/haptic-button";
import { useStartupReady } from "@/components/modules/system";
import { haptic } from "@/lib/haptics";

import release from "../../version.json";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

export default function HomeScreen() {
  const [enabled, setEnabled] = useState(true);
  const markStartupReady = useStartupReady();
  const rows = [
    ["App version", Constants.expoConfig?.version ?? release.version],
    ["Version code", String(release.versionCode)],
  ] as const;

  function toggle() {
    const next = !enabled;
    haptic(next ? "toggle-on" : "toggle-off");
    setEnabled(next);
  }

  return (
    <View className="flex-1 bg-background p-safe" onLayout={markStartupReady}>
      <ScrollView className="flex-1">
        <View className="px-6 py-8">
          <View className="mb-8 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-2xl font-black text-primary-foreground">HS</Text>
          </View>

          <Text className="text-3xl font-black tracking-tight text-foreground">
            Hisaabsathi Connector
          </Text>

          <View className="mt-8 overflow-hidden rounded-3xl border border-border bg-card">
            {rows.map(([label, value], index) => (
              <View
                className={`px-5 py-4 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
                key={label}
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </Text>
                <Text className="mt-1 text-sm font-semibold text-card-foreground" selectable>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <Section title="Impact">
            <View className="flex-row gap-3">
              <HapticButton kind="light" label="Light" />
              <HapticButton kind="medium" label="Medium" />
              <HapticButton kind="heavy" label="Heavy" tone="brand" />
            </View>
          </Section>

          <Section title="Notification">
            <View className="flex-row gap-3">
              <HapticButton kind="success" label="Success" tone="success" />
              <HapticButton kind="warning" label="Warning" tone="warning" />
              <HapticButton kind="error" label="Error" tone="danger" />
            </View>
          </Section>

          <Section title="Selection">
            <HapticButton kind="selection" label="Tick" />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
              className="h-14 flex-row items-center justify-between rounded-2xl border border-border bg-card px-5"
              onPress={toggle}
            >
              <Text className="text-sm font-bold text-card-foreground">Toggle</Text>
              <View
                className={`h-7 w-12 justify-center rounded-full px-1 ${enabled ? "items-end bg-primary" : "items-start bg-secondary"}`}
              >
                <View className="h-5 w-5 rounded-full bg-primary-foreground" />
              </View>
            </Pressable>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}
