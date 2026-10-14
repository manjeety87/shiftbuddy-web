"use client";

import { Clock } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/shiftTime";
import { inputClass } from "./Field";
import { Popover } from "./Popover";

const STEP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** "5:30 PM" — the app's own clock wording, the same on every browser. */
export const formatPickedTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
};

/** What people actually type: "5:30 pm", "530p", "17:30", "9". Null when it isn't a time. */
const parseTime = (text: string): number | null => {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p)?\.?m?\.?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (match[3] === "p" ? 12 : 0);
  }
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
};

function TimeList({ selected, after, onPick }: { selected: number; after?: number; onPick: (minutes: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const parsed = parseTime(typed);

  // An end time lists what comes after the start, each with how long that makes the shift
  const first = after === undefined ? 0 : (Math.floor(after / STEP_MINUTES) + 1) * STEP_MINUTES;
  const options = Array.from({ length: DAY_MINUTES / STEP_MINUTES }, (_, index) => (first + index * STEP_MINUTES) % DAY_MINUTES);

  // Open on the current time, not at midnight
  useLayoutEffect(() => {
    const box = list.current;
    const current = box?.querySelector<HTMLElement>("[aria-selected=true]") ?? box?.querySelector<HTMLElement>("[data-nearest]");
    if (box && current) box.scrollTop = current.offsetTop - box.clientHeight / 2 + current.clientHeight / 2;
  }, []);

  const nearest = options.reduce((best, option) => (Math.abs(option - selected) < Math.abs(best - selected) ? option : best), options[0]);

  return (
    <div className="flex w-52 flex-col">
      <form
        className="border-b border-border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed !== null) onPick(parsed);
        }}
      >
        <input
          autoFocus
          aria-label="Type a time"
          aria-invalid={typed.trim() !== "" && parsed === null ? true : undefined}
          placeholder="Type a time — 5:30 pm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="h-9 w-full rounded-lg bg-card/70 px-2.5 text-[16px] tabular-nums shadow-[0_0_0_1px_var(--line-strong)] placeholder:text-muted-foreground focus:shadow-[0_0_0_2px_var(--primary)] focus:outline-none aria-invalid:shadow-[0_0_0_2px_var(--destructive)] md:h-8 md:text-sm"
        />
        {typed.trim() !== "" && <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">{parsed === null ? "That isn’t a time. Try 5:30 pm or 17:30." : `Press Enter for ${formatPickedTime(parsed)}`}</p>}
      </form>
      <div ref={list} role="listbox" aria-label="Times" className="relative max-h-60 overflow-y-auto overscroll-contain p-1.5">
        {options.map((option) => {
          const length = after === undefined ? null : (option - after + DAY_MINUTES) % DAY_MINUTES;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === selected}
              data-nearest={option === nearest ? "" : undefined}
              onClick={() => onPick(option)}
              className={`flex h-9 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-sm tabular-nums md:h-8 ${option === selected ? "bg-primary font-semibold text-primary-foreground" : "row-hover"}`}
            >
              {formatPickedTime(option)}
              {length !== null && (
                <span className={`text-xs font-normal ${option === selected ? "opacity-85" : "text-muted-foreground"}`}>
                  {formatDuration(length)}
                  {option <= (after ?? 0) && " · next day"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TimePickerProps {
  id?: string;
  /** Names the control when there is no visible <label> for `id` */
  label?: string;
  /** Only the time of day is read */
  value: Date;
  onChange: (time: Date) => void;
  /** For an end time: the start, so the list can say how long each choice makes it */
  after?: Date;
  /** In a table cell: no field chrome until it is pointed at */
  quiet?: boolean;
}

/** A time as a button that opens a list in quarter hours — or type any time. 12-hour everywhere, unlike the browser's own time field. */
export function TimePicker({ id, label, value, onChange, after, quiet = false }: TimePickerProps) {
  const selected = minutesOf(value);

  return (
    <Popover
      label={label ?? "Choose a time"}
      buttonId={id}
      buttonLabel={label ? `${label}: ${formatPickedTime(selected)}` : undefined}
      buttonClassName={`${inputClass} flex items-center gap-2 text-left tabular-nums ${quiet ? "quiet-field" : ""}`}
      button={
        <>
          <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatPickedTime(selected)}</span>
        </>
      }
    >
      {(close) => (
        <TimeList
          selected={selected}
          after={after ? minutesOf(after) : undefined}
          onPick={(minutes) => {
            const time = new Date(value);
            time.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
            onChange(time);
            close();
          }}
        />
      )}
    </Popover>
  );
}
