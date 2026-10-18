import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Stands in for a page's header while rows are being picked, as on the phone
 * app's Shifts and Jobs tabs: ✕ and the count on the left, what can be done to
 * the picked rows on the right. Same place and height as `PageHeader`, so the
 * page doesn't jump when selecting starts.
 */
export function SelectionHeader({ count, onDone, children }: { count: number; onDone: () => void; children: ReactNode }) {
  return (
    <header
      role="toolbar"
      aria-label="Selected"
      className="frosted sticky top-0 z-10 -mx-4 mb-5 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6 lg:-mx-10 lg:mb-7 lg:px-10"
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label="Done selecting"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-[scale,background-color] duration-150 ease-out active:scale-[0.94] pointer-fine:hover:bg-hover"
        >
          <X aria-hidden className="size-5" />
        </button>
        <p aria-live="polite" className="truncate text-base font-semibold tabular-nums">
          {count} selected
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </header>
  );
}

/** The tick box at the end of a row while selecting. Decorative: the row itself is the checkbox. */
export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-4.5 items-center justify-center rounded-[5px] transition-[background-color,box-shadow] duration-150 ease-out ${checked ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}
