import type { Metadata } from "next";
import { TimesheetPage } from "@/features/timesheet/TimesheetPage";

export const metadata: Metadata = { title: "Timesheet" };

export default function Page() {
  return <TimesheetPage />;
}
