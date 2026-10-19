import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Loader, useStartupReady } from "@/components/modules/system";
import { useAuthSession } from "@/lib/auth/session";

export default function HomeScreen() {
  const markStartupReady = useStartupReady();
  const { isReady, signOut, token } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);
  // Don't mark startup ready yet: the root loader stays up until real content lays out.
  if (!isReady) return <Loader fullPage />;
  if (!token)
    return (
      <>
        <Loader fullPage />
        <Redirect href="/auth" />
      </>
    );
  return (
    <View
      className="flex-1 items-center justify-center bg-background p-6"
      onLayout={markStartupReady}
    >
      <View className="w-full max-w-md border border-border bg-card p-6">
        <Text className="text-2xl font-bold text-foreground">Connector</Text>
        <Text className="mt-2 text-base leading-6 text-muted-foreground">
          You are securely connected to Hisaab Sathi.
        </Text>
        <Pressable
          className={`mt-7 h-12 items-center justify-center bg-primary ${signingOut ? "opacity-70" : ""}`}
          disabled={signingOut}
          onPress={() => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          }}
        >
          {signingOut ? (
            <ActivityIndicator color="#F9FBFF" />
          ) : (
            <Text className="font-semibold text-primary-foreground">Sign out</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
