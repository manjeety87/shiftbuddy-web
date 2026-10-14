"use client";

import { CalendarDays, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { startOfDay } from "@/lib/inputs";
import { inputClass } from "./Field";
import { Popover } from "./Popover";

/** "Thu, Oct 8" — the app's own date wording, the same on every browser; the year only when it isn't this one. */
export const formatPickedDate = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });

// The grid comes from react-day-picker (headless); how it looks is ours
const CALENDAR = {
  root: "p-3 select-none",
  months: "relative",
  month_caption: "flex h-8 items-center px-1.5",
  caption_label: "text-sm font-semibold",
  nav: "absolute top-0 right-0 flex gap-0.5",
  button_previous: "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[scale] duration-150 ease-out row-hover active:scale-90",
  button_next: "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[scale] duration-150 ease-out row-hover active:scale-90",
  chevron: "size-4 fill-current",
  month_grid: "mt-1 border-collapse",
  weekday: "size-9 text-2xs font-medium text-muted-foreground",
  day: "p-0 text-center",
  day_button: "size-9 rounded-full text-sm tabular-nums transition-[scale,background-color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-pressed",
  today: "font-bold text-primary",
  selected: "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] pointer-fine:[&>button]:hover:bg-primary",
  outside: "text-faint",
  disabled: "pointer-events-none opacity-30",
};

interface DatePickerProps {
  id?: string;
  /** Names the control when there is no visible <label> for `id` */
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  /** Optional dates can be emptied again */
  onClear?: () => void;
  max?: Date;
  placeholder?: string;
  /** In a table cell: no field chrome until it is pointed at */
  quiet?: boolean;
}

/** A date as a button that opens a month. Reads the same everywhere, unlike the browser's own date field. */
export function DatePicker({ id, label, value, onChange, onClear, max, placeholder = "Choose a date", quiet = false }: DatePickerProps) {
  const today = startOfDay(new Date());
  const canPickToday = !max || today <= max;

  return (
    <span className="relative block">
      <Popover
        label={label ?? "Choose a date"}
        buttonId={id}
        buttonLabel={label ? `${label}: ${value ? formatPickedDate(value) : placeholder}` : undefined}
        buttonClassName={`${inputClass} flex items-center gap-2 text-left tabular-nums ${quiet ? "quiet-field" : ""} ${onClear && value ? "pr-9" : ""}`}
        button={
          <>
            <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value ? formatPickedDate(value) : placeholder}</span>
          </>
        }
      >
      {(close) => (
        <>
          <DayPicker
            mode="single"
            autoFocus
            showOutsideDays
            selected={value ?? undefined}
            defaultMonth={value ?? today}
            disabled={max ? { after: max } : undefined}
            onSelect={(date) => {
              if (date) onChange(date);
              close();
            }}
            classNames={CALENDAR}
          />
          {canPickToday && (
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                className="h-8 w-full rounded-lg text-sm font-medium text-primary row-hover"
                onClick={() => {
                  onChange(today);
                  close();
                }}
              >
                Today
              </button>
            </div>
          )}
        </>
      )}
      </Popover>
      {onClear && value && (
        <button type="button" aria-label="Clear the date" onClick={onClear} className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground row-hover">
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  );
}
