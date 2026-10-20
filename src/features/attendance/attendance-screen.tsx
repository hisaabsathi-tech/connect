import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { fetchCanViewAllAttendance } from "@/lib/api/attendance-roster";
import { useAuthSession } from "@/lib/auth/session";
import { haptic } from "@/lib/haptics";

import { CompanyAttendance } from "./company-attendance";
import { OwnAttendance } from "./own-attendance";

type AttendanceView = "company" | "own";

const TABS: { label: string; value: AttendanceView }[] = [
  { label: "Company", value: "company" },
  { label: "Own", value: "own" },
];

function ViewTabs({
  onChange,
  value,
}: {
  onChange: (next: AttendanceView) => void;
  value: AttendanceView;
}) {
  return (
    <View accessibilityRole="tablist" className="mt-4 flex-row border border-border bg-card">
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`h-10 flex-1 items-center justify-center ${active ? "bg-primary" : ""}`}
            key={tab.value}
            onPress={() => {
              if (active) return;
              haptic("selection");
              onChange(tab.value);
            }}
          >
            <Text
              className={`text-sm font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Whether the member may see everyone's attendance; null until known. */
function useCanViewAll(token: string | null) {
  const [canViewAll, setCanViewAll] = useState<boolean | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchCanViewAllAttendance(token)
      .then((allowed) => {
        if (active) setCanViewAll(allowed);
      })
      // Unknown access falls back to the member's own attendance.
      .catch(() => {
        if (active) setCanViewAll(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return canViewAll;
}

/**
 * The Attendance tab. Admins (attendance GET_ALL) get Company / Own tabs: the organisation's
 * roster by default, or their own attendance like any member's. Everyone else sees their own.
 */
export function AttendanceScreen() {
  const { token } = useAuthSession();
  const canViewAll = useCanViewAll(token);
  const [view, setView] = useState<AttendanceView>("company");

  if (canViewAll === null)
    return (
      <TabScreen>
        <Loader fullPage />
      </TabScreen>
    );
  if (!canViewAll) return <OwnAttendance />;
  const tabs = <ViewTabs onChange={setView} value={view} />;
  return view === "company" ? <CompanyAttendance tabs={tabs} /> : <OwnAttendance tabs={tabs} />;
}
