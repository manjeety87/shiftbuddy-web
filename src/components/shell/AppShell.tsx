"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { closeAllSheets, openSheet } from "@/lib/sheets";
import { LoadError } from "../ui/States";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "./CommandPalette";
import { SheetHost } from "./SheetHost";
import { Sidebar } from "./Sidebar";

/** Everything behind login. Waits for the session, and sends signed-out visitors to the login page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, retry } = useSession();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const isSignedIn = session.status === "signedIn";

  useEffect(() => {
    if (session.status !== "anonymous") return;
    closeAllSheets();
    router.replace("/login");
  }, [session.status, router]);

  // Ctrl/⌘ K = search, from anywhere. N = new shift — unless the person is typing or a panel is open.
  useEffect(() => {
    if (!isSignedIn) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearching((value) => !value);
        return;
      }
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (key !== "n" || event.metaKey || event.ctrlKey || event.altKey || typing || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      openSheet({ kind: "shift" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSignedIn]);

  if (session.status === "unreachable") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center px-4">
        <div className="w-full">
          <LoadError message="Can’t reach ShiftBuddy right now. Check your connection and try again." onRetry={retry} />
        </div>
      </div>
    );
  }

  if (session.status !== "signedIn") {
    return (
      <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
        <span className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">S</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-30 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">
        Skip to content
      </a>
      <Sidebar onSearch={() => setSearching(true)} />
      {/* Bottom padding keeps the last row clear of the phone tab bar */}
      {/* Keyed by person: nothing one account loaded may still be on screen for the next */}
      <main key={session.user.id} id="content" className="mx-auto w-full max-w-[76rem] min-w-0 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-12 lg:px-10">
        {children}
      </main>
      <BottomNav />
      <SheetHost />
      {searching && <CommandPalette onClose={() => setSearching(false)} />}
    </div>
  );
}
