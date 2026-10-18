import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Where ‹ goes: a page (`href`) or a step back within this one (`onClick`). */
export interface PageBack {
  /** Named for screen readers: "Back to Settings" */
  label: string;
  href?: string;
  onClick?: () => void;
}

const backClass = "-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-[scale,background-color] duration-150 ease-out active:scale-[0.94] md:hidden pointer-fine:hover:bg-hover";

/**
 * The bar at the top of a page: its title, and its actions on the right. It stays
 * put while the page scrolls under it, translucent, and only shows an edge once
 * something is actually underneath (`scroll-edge`).
 * `back` is for a phone's screens that open from another one (Settings → Timesheet):
 * ‹ sits before the title, as in the phone app. Wide screens have the sidebar instead.
 */
export function PageHeader({ title, description, actions, eyebrow, back }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string; back?: PageBack }) {
  return (
    <header className="frosted scroll-edge sticky top-0 z-10 -mx-4 mb-5 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6 lg:-mx-10 lg:mb-7 lg:px-10">
      <div className="flex min-w-0 items-center gap-1">
        {back &&
          (back.href ? (
            <Link href={back.href} aria-label={`Back to ${back.label}`} className={backClass}>
              <ChevronLeft aria-hidden className="size-5.5" />
            </Link>
          ) : (
            <button type="button" onClick={back.onClick} aria-label={`Back to ${back.label}`} className={backClass}>
              <ChevronLeft aria-hidden className="size-5.5" />
            </button>
          ))}
        <div className="min-w-0">
          {eyebrow && <p className="truncate text-xs text-muted-foreground">{eyebrow}</p>}
          <h1 className="line-clamp-2 text-xl font-bold text-balance wrap-anywhere sm:truncate sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 hidden truncate text-sm text-muted-foreground sm:block">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
