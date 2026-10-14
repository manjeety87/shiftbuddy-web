"use client";

import type { CSSProperties, ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "@/lib/session";
import { useResolvedMode } from "./theme/useTheme";
import { DialogHost } from "./ui/DialogHost";

// Sonner reads its colours from these, so toasts follow the theme
const TOAST_COLOURS = {
  "--normal-bg": "var(--card)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--muted)",
} as CSSProperties;

export function Providers({ children }: { children: ReactNode }) {
  // Keeps the page listening on every screen: "Auto" turns dark when the device does, another tab's choice is followed
  useResolvedMode();

  return (
    <SessionProvider>
      {children}
      <DialogHost />
      {/* On a phone the toast sits above the tab bar */}
      <Toaster position="bottom-center" style={TOAST_COLOURS} mobileOffset={{ bottom: 84 }} toastOptions={{ style: { borderRadius: 14, fontFamily: "inherit" } }} />
    </SessionProvider>
  );
}
