"use client";

import { useId, type ReactNode } from "react";
import { formatDuration, resolveShiftRange, withNewStart, type ShiftTimes } from "@/lib/shiftTime";
import { DatePicker } from "./ui/DatePicker";
import { TimePicker } from "./ui/TimePicker";

/**
 * One day, a start and an end, side by side — never an "end date". An end at or
 * before the start means the shift runs past midnight, and the note says so.
 * Moving the start keeps the length, like a calendar. All three are in the
 * device's own time zone and read the same on every browser.
 */
export function TimeFields({ value, onChange, maxDate }: { value: ShiftTimes; onChange: (next: ShiftTimes) => void; maxDate?: Date }) {
  const id = useId();
  const range = resolveShiftRange(value);

  const field = (name: string, text: string, input: ReactNode) => (
    <div className="min-w-0">
      <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-sm font-medium">
        {text}
      </label>
      {input}
    </div>
  );

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 sm:col-span-1">{field("date", "Date", <DatePicker id={`${id}-date`} value={value.date} max={maxDate} onChange={(date) => onChange({ ...value, date })} />)}</div>
        {field("start", "Starts", <TimePicker id={`${id}-start`} value={value.start} onChange={(start) => onChange(withNewStart(value, start))} />)}
        {field("end", "Ends", <TimePicker id={`${id}-end`} value={value.end} after={value.start} onChange={(end) => onChange({ ...value, end })} />)}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {formatDuration(range.durationMinutes)} long{range.isOvernight ? " · ends the next day" : ""}
      </p>
    </div>
  );
}
