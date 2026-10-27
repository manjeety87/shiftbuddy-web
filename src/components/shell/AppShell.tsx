"use client";

import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Assistant } from "@/features/assistant/Assistant";
import { openAssistant, toggleAssistant, useAssistantOpen } from "@/features/assistant/assistantOpen";
import { useSession } from "@/lib/session";
import { closeAllSheets, openNewShift } from "@/lib/sheets";
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
  const assistant = useAssistantOpen();

  useEffect(() => {
    if (session.status !== "anonymous") return;
    closeAllSheets();
    router.replace("/login");
  }, [session.status, router]);

  // Ctrl/⌘ K = search, Ctrl/⌘ J = the assistant, from anywhere. N = new shift — unless the person is typing or a panel is open.
  useEffect(() => {
    if (!isSignedIn) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearching((value) => !value);
        return;
      }
      if (key === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleAssistant();
        return;
      }
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (key !== "n" || event.metaKey || event.ctrlKey || event.altKey || typing || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      openNewShift();
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
      {/* Bottom padding keeps the last row clear of the phone tab bar and the assistant button above it */}
      {/* Keyed by person: nothing one account loaded may still be on screen for the next */}
      <main key={session.user.id} id="content" className="mx-auto w-full max-w-[76rem] min-w-0 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-12 lg:px-10">
        {children}
      </main>
      <BottomNav />
      {/* On a phone the assistant is a thumb away, just above the tabs; wider screens open it from the sidebar */}
      {!assistant.open && (
        <button
          type="button"
          aria-label="Assistant"
          onClick={() => openAssistant()}
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop transition-[scale] duration-150 ease-out active:scale-90 md:hidden"
        >
          <Mic aria-hidden className="size-5" />
        </button>
      )}
      <SheetHost />
      {searching && <CommandPalette onClose={() => setSearching(false)} />}
      {/* Keyed by person, like the page: one account’s conversation never shows for the next */}
      <Assistant key={`assistant-${session.user.id}`} />
    </div>
  );
}
