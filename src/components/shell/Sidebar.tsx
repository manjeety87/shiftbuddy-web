"use client";

import { ChevronsUpDown, LogOut, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLogOut, useUser } from "@/lib/session";
import { openNewShift } from "@/lib/sheets";
import { Kbd } from "../ui/Button";
import { isActive, SETTINGS, SIDEBAR_GROUPS, type NavItem } from "./nav";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Who is signed in, and the two things you do about it. Opens upward, from the button that asked. */
function AccountMenu() {
  const user = useUser();
  const logOut = useLogOut();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];

  useEffect(() => {
    if (!open) return;
    // A menu takes the keyboard when it opens, so the arrows work at once
    items()[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // The keys a menu is expected to answer: arrows walk it, Home/End jump, Esc gives focus back to the button, Tab leaves
  const onMenuKey = (event: KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      event.preventDefault();
      all[(index + all.length) % all.length]?.focus();
    };
    if (event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowUp") go(at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(all.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") setOpen(false);
  };

  const item = "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm row-hover";

  return (
    <div ref={holder} className="relative">
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute bottom-full left-0 z-20 mb-1.5 w-60 origin-bottom-left glass rounded-xl! p-1 transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0"
        >
          <div className="border-b border-border px-2 pt-1.5 pb-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="pt-1">
            <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>
              <Settings aria-hidden className="size-4 text-muted-foreground" />
              Settings
            </Link>
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                logOut();
              }}
            >
              <LogOut aria-hidden className="size-4 text-muted-foreground" />
              Log out
            </button>
          </div>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg text-left transition-[scale] duration-150 ease-out row-hover active:scale-[0.98] lg:justify-start lg:px-2"
      >
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xs font-semibold text-primary">
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 flex-1 lg:block">
          <span className="block truncate text-sm leading-tight font-medium">{user.name}</span>
          <span className="block truncate text-xs leading-tight text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown aria-hidden className="hidden size-3.5 shrink-0 text-faint lg:block" />
      </button>
    </div>
  );
}

/**
 * Desktop and tablet navigation: the heavier material that holds the app's
 * structure. A slim icon rail from 768px, the full sidebar from 1024px; phones get
 * `BottomNav`. Changing section is instant on purpose — it happens all day, so
 * nothing here animates but the press.
 */
export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  // Only ever rendered in the browser (the shell waits for the session), so the platform is known
  const searchKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  const link = ({ href, label, icon: Icon }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        // Names the icon while the rail hides its label
        title={label}
        className={`flex h-9 items-center justify-center gap-2.5 rounded-lg text-sm transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.97] lg:h-8 lg:justify-start lg:px-2 ${
          active ? "bg-pressed font-semibold text-foreground" : "font-medium text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
        }`}
      >
        <Icon aria-hidden className={`size-[17px] shrink-0 ${active ? "text-primary" : ""}`} />
        <span className="sr-only lg:not-sr-only">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[68px] shrink-0 flex-col border-r border-border bg-sidebar px-3 pt-4 pb-3 md:flex lg:w-60">
      <Link href="/home" className="mb-4 flex h-8 items-center justify-center gap-2.5 rounded-lg lg:justify-start lg:px-2">
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
          S
        </span>
        <span className="sr-only text-base font-semibold lg:not-sr-only">ShiftBuddy</span>
      </Link>

      <div className="mb-4 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onSearch}
          title="Search"
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-card/70 text-sm text-muted-foreground shadow-card transition-[scale,background-color] duration-150 ease-out active:scale-[0.98] lg:h-8 lg:justify-start lg:px-2.5 pointer-fine:hover:bg-card"
        >
          <Search aria-hidden className="size-4 shrink-0" />
          <span className="sr-only flex-1 text-left lg:not-sr-only">Search</span>
          <Kbd className="max-lg:hidden!">{searchKey}</Kbd>
        </button>
        <button
          type="button"
          onClick={openNewShift}
          title="New shift"
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.14)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.98] lg:h-8 lg:justify-start lg:px-2.5 pointer-fine:hover:bg-primary-hover"
        >
          <Plus aria-hidden className="size-4 shrink-0" />
          <span className="sr-only flex-1 text-left lg:not-sr-only">New shift</span>
          <kbd aria-hidden className="hidden rounded-[5px] bg-white/20 px-1.5 py-px font-sans text-2xs font-medium lg:pointer-fine:inline-block">
            N
          </kbd>
        </button>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="mb-1 hidden px-2 text-2xs font-semibold text-muted-foreground lg:block">{group.label}</p>
            {group.items.map(link)}
          </div>
        ))}
      </nav>

      <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
        {link(SETTINGS)}
        <AccountMenu />
      </div>
    </aside>
  );
}
