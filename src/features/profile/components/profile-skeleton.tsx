import { View } from "react-native";

import { Skeleton } from "@/components/modules/skeleton";

// The detail rows under the profile card (phone, email, organisations…).
const DETAIL_ROWS = ["phone", "email", "organization", "role"];

/** The profile page on its first load: title, the photo card and the detail rows, in place. */
export function ProfileSkeleton() {
  return (
    <View className="px-5">
      <Skeleton height={26} width="34%" />
      <Skeleton className="mt-2" height={14} width="58%" />
      <View className="mt-6 flex-row items-center gap-5 bg-[#F0F2FF] p-3">
        <Skeleton height={64} width={64} />
        <View className="flex-1 gap-2">
          <Skeleton height={18} width="60%" />
          <Skeleton height={12} width="35%" />
        </View>
      </View>
      <View className="mt-3 border border-border bg-[#FAFBFF] px-3">
        {DETAIL_ROWS.map((row) => (
          <View className="flex-row items-center gap-3 border-border border-b py-4" key={row}>
            <Skeleton height={20} width={20} />
            <View className="flex-1 gap-2">
              <Skeleton height={10} width="28%" />
              <Skeleton height={14} width="64%" />
            </View>
          </View>
        ))}
      </View>
      <Skeleton className="mt-3" height={52} />
      <Skeleton className="mt-3" height={48} />
    </View>
  );
}
