import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// Only for devices without a system UI face of their own; the optical-size axis
// gives large titles their display cut
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "ShiftBuddy", template: "%s · ShiftBuddy" },
  description: "Every shift from every job in one place.",
};

// `cover` lets the bottom tab bar sit above the phone's home indicator
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script may change data-theme and data-mode before React hydrates
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-mode="light"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
