import type { Metadata } from "next";
import { ResetPasswordFlow } from "@/features/auth/ResetPasswordFlow";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <ResetPasswordFlow />;
}
