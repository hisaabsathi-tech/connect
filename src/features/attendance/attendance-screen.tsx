import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { TabScreen } from "@/components/modules/layout";
import { Loader } from "@/components/modules/system";
import { Text } from "@/components/modules/typography";
import { fetchOpenAttendance } from "@/lib/api/attendance";
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

type Access = {
  /** attendance GET_ALL: the organisation's roster. */
  canViewAll: boolean;
  /** Checks in themselves; false for a superadmin while Superadmin Attendance is off. */
  selfAttendance: boolean;
};

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

/** What the member's Attendance tab shows; null until known. */
function useAccess(token: string | null) {
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([
      // Unknown access falls back to the member's own attendance.
      fetchCanViewAllAttendance(token).catch(() => false),
      fetchOpenAttendance(token)
        // Older servers don't send it; everyone checked in before the module existed.
        .then((status) => status.selfAttendance !== false)
        .catch(() => true),
    ]).then(([canViewAll, selfAttendance]) => {
      if (active) setAccess({ canViewAll, selfAttendance });
    });
    return () => {
      active = false;
    };
  }, [token]);
  return access;
}

/**
 * The Attendance tab. Admins (attendance GET_ALL) get the organisation's roster; those who also
 * check in themselves (a superadmin only with Superadmin Attendance on) get Company / Own tabs to
 * see their own attendance too. Everyone else sees their own.
 */
export function AttendanceScreen() {
  const { token } = useAuthSession();
  const access = useAccess(token);
  const [view, setView] = useState<AttendanceView>("company");

  if (!access)
    return (
      <TabScreen>
        <Loader fullPage />
      </TabScreen>
    );
  if (!access.canViewAll) return <OwnAttendance />;
  if (!access.selfAttendance) return <CompanyAttendance />;
  const tabs = <ViewTabs onChange={setView} value={view} />;
  return view === "company" ? <CompanyAttendance tabs={tabs} /> : <OwnAttendance tabs={tabs} />;
}
