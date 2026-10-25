import { BriefcaseBusiness, CalendarClock, CalendarDays, ClipboardList, House, Settings, Users, type LucideIcon } from "lucide-react";
import type { Features } from "@/interfaces/user.d";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const HOME = { href: "/home", label: "Home", icon: House };
const SHIFTS = { href: "/shifts", label: "Shifts", icon: CalendarClock };
const CALENDAR = { href: "/calendar", label: "Calendar", icon: CalendarDays };
const JOBS = { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness };
const TIMESHEET = { href: "/timesheet", label: "Timesheet", icon: ClipboardList };
const SHARING = { href: "/sharing", label: "Sharing", icon: Users };
export const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** The sidebar has room for every place, grouped by what you came to do. */
export const SIDEBAR_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Schedule", items: [HOME, SHIFTS, CALENDAR] },
  { label: "Work", items: [JOBS, TIMESHEET] },
  { label: "People", items: [SHARING] },
];

export const ALL_PLACES: NavItem[] = [...SIDEBAR_GROUPS.flatMap((group) => group.items), SETTINGS];

/** A phone's tab bar fits five — the mobile app's tabs. Timesheet and Sharing are reached from Settings there. */
export const TAB_ITEMS: NavItem[] = [HOME, SHIFTS, CALENDAR, JOBS, SETTINGS];

/** Whether a place is part of the app as switched on (Settings › Features): Timesheet goes with the timesheet. */
export const isShown = (features: Features) => (item: NavItem) => item.href !== TIMESHEET.href || features.timesheet;

/** A section stays lit on its inner pages too. */
export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
