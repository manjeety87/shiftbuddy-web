import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

export default function Page() {
  return <RegisterForm />;
}
