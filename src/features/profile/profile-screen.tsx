import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { TabScreen, useScrollFit } from "@/components/modules/layout";
import { PhotoDialog } from "@/components/modules/photo";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { colors } from "@/config/colors";
import { useAuthSession } from "@/lib/auth/session";

import { BrandFooter } from "./components/brand-footer";
import { ChangePassword } from "./components/change-password";
import { LogoutButton } from "./components/logout-button";

import { ProfileCard } from "./components/profile-card";
import { ProfileDetails } from "./components/profile-details";
import { useProfilePhoto } from "./components/profile-photo";
import { useProfile } from "./hooks/use-profile";

export function ProfileScreen() {
  const { token } = useAuthSession();
  const { loading, profile, refresh, refreshing, save, savePhoto, saving } = useProfile(token);
  const photo = useProfilePhoto(savePhoto);
  const [viewing, setViewing] = useState(false);
  // Scrolls only when the profile is taller than the screen.
  const scrollFit = useScrollFit();

  return (
    <TabScreen>
      {loading ? (
        <Loader fullPage size={"md"} />
      ) : (
        <ScrollView
          {...scrollFit}
          className="flex-1"
          // Enough room below the footer that its last line scrolls clear of the tab bar.
          contentContainerClassName="flex-grow px-5 pb-12"
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
          <Text className="text-2xl font-semibold leading-8 text-foreground">Profile</Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">Manage your profile details</Text>
          <View className="flex-1 justify-between pt-2">
            <View>
              <ProfileCard
                onEditPhoto={photo.open}
                onViewPhoto={() => setViewing(true)}
                profile={profile}
              />
              <ProfileDetails onSave={save} profile={profile} saving={saving} token={token} />
              <ChangePassword email={profile?.email} />
              <LogoutButton />
            </View>
            {/* Pinned to the bottom when there is room; never closer than this to the logout. */}
            <View className="pt-8">
              <BrandFooter />
            </View>
          </View>
        </ScrollView>
      )}
      {photo.element}
      <PhotoDialog
        onClose={() => setViewing(false)}
        title="Profile photo"
        uri={profile?.image ?? null}
        visible={viewing && Boolean(profile?.image)}
      />
    </TabScreen>
  );
}
