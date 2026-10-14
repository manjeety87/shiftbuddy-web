import type { ReactNode } from "react";

/**
 * The bar at the top of a page: its title, and its actions on the right. It stays
 * put while the page scrolls under it, translucent, and only shows an edge once
 * something is actually underneath (`scroll-edge`).
 */
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="frosted scroll-edge sticky top-0 z-10 -mx-4 mb-5 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6 lg:-mx-10 lg:mb-7 lg:px-10">
      <div className="min-w-0">
        {eyebrow && <p className="truncate text-xs text-muted-foreground">{eyebrow}</p>}
        <h1 className="line-clamp-2 text-xl font-bold text-balance wrap-anywhere sm:truncate sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 hidden truncate text-sm text-muted-foreground sm:block">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
