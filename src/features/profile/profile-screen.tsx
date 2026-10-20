import { RefreshControl, ScrollView, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { useAuthSession } from "@/lib/auth/session";

import { BrandFooter } from "./components/brand-footer";
import { LogoutButton } from "./components/logout-button";
import { ProfileCard } from "./components/profile-card";
import { ProfileDetails } from "./components/profile-details";
import { useProfile } from "./hooks/use-profile";

export function ProfileScreen() {
  const { token } = useAuthSession();
  const { loading, profile, refresh, refreshing, save, saving } = useProfile(token);

  return (
    <TabScreen>
      {loading ? (
        <Loader fullPage size={"md"} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={refresh}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
        >
          <Text className="text-2xl font-semibold leading-7 text-foreground">Profile</Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">Manage your profile details</Text>
          <View className="flex-1 justify-between pt-2">
            <View>
              <ProfileCard profile={profile} />
              <ProfileDetails onSave={save} profile={profile} saving={saving} token={token} />
              <LogoutButton />
            </View>
            <BrandFooter />
          </View>
        </ScrollView>
      )}
    </TabScreen>
  );
}
