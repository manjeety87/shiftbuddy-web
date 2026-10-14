import { ChevronLeft, ChevronRight } from "lucide-react";

const arrow =
  "flex size-9 items-center justify-center text-muted-foreground transition-[background-color,color] duration-100 pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground active:bg-pressed disabled:pointer-events-none disabled:opacity-30 md:size-7";

/**
 * Oct 4 – 10  [‹ Today ›] — steps a week, month or pay period. The label leads and
 * the stepper is one joined control, the way a desktop toolbar does it. "Today" is
 * live only once you've moved away.
 */
export function PeriodNav({ label, context, onPrevious, onNext, onToday, nextDisabled = false, className = "mb-4" }: { label: string; /** "This week" — said before the dates where there is room; a phone keeps just the dates */ context?: string; onPrevious: () => void; onNext: () => void; onToday?: () => void; nextDisabled?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p aria-live="polite" className="min-w-0 truncate text-base font-semibold tabular-nums sm:text-lg">
        {context && <span className="max-sm:hidden">{context} · </span>}
        {label}
      </p>
      <div className="flex shrink-0 items-center divide-x divide-border overflow-hidden rounded-lg bg-card shadow-card">
        <button type="button" aria-label="Earlier" className={arrow} onClick={onPrevious}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          className="h-9 px-3 text-sm font-medium transition-[background-color] duration-100 active:bg-pressed disabled:text-faint md:h-7 md:px-2.5 pointer-fine:hover:bg-hover"
          onClick={onToday}
          disabled={!onToday}
        >
          Today
        </button>
        <button type="button" aria-label="Later" className={arrow} onClick={onNext} disabled={nextDisabled}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
