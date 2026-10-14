import { AuthFrame } from "@/features/auth/AuthFrame";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthFrame>{children}</AuthFrame>;
}
