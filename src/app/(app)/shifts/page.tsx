import type { Metadata } from "next";
import { ShiftsPage } from "@/features/shifts/ShiftsPage";

export const metadata: Metadata = { title: "Shifts" };

export default function Page() {
  return <ShiftsPage />;
}
