import type { Metadata } from "next";
import { SharingPage } from "@/features/sharing/SharingPage";

export const metadata: Metadata = { title: "Sharing" };

export default function Page() {
  return <SharingPage />;
}
