"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, TAB_ITEMS } from "./nav";

/** Phone navigation (under 768px): five tabs within thumb reach, a translucent layer the page scrolls under. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="frosted fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium transition-[scale,color] duration-150 ease-out active:scale-[0.94] ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
