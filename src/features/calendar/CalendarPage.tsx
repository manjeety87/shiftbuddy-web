"use client";

import { Plus } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { PeriodSummary } from "@/components/PeriodSummary";
import { isHappeningNow, ShiftList, ShiftRow, shortTime } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { isSameDay, toCalendarDateString } from "@/lib/dateUtils";
import { addDays, formatDayLabel, startOfDay } from "@/lib/inputs";
import { jobName } from "@/lib/jobLabels";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { getMyShifts } from "@/lib/shifts";
import { openSheet } from "@/lib/sheets";
import { useFetch } from "@/lib/useFetch";
import { useNow } from "@/lib/useNow";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How many shifts a day cell names before it says "+2 more" */
const CELL_SHIFTS = 2;

export function CalendarPage() {
  const now = useNow();
  const grid = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const weeks = Math.ceil((monthStart.getDay() + new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
  const gridEnd = addDays(gridStart, weeks * 7);

  // A day early, so an overnight shift from the day before the grid is included
  const { data, error, retry, refetch } = useFetch(() => getMyShifts({ from: addDays(gridStart, -1).toISOString(), to: gridEnd.toISOString() }), [gridStart.getTime()]);
  useShiftsChanged(refetch);

  const byDay = new Map<string, Shift[]>();
  data?.forEach((shift) => {
    const key = toCalendarDateString(shift.startTime);
    byDay.set(key, [...(byDay.get(key) ?? []), shift]);
  });

  const dayStart = selected.getTime();
  const dayEnd = addDays(selected, 1).getTime();
  const dayShifts = data?.filter((shift) => Date.parse(shift.startTime) < dayEnd && Date.parse(shift.endTime) > dayStart) ?? [];
  const monthName = monthStart.toLocaleDateString("en-US", { month: "long" });
  const isThisMonth = monthStart.getMonth() === new Date(now).getMonth() && monthStart.getFullYear() === new Date(now).getFullYear();

  const move = (days: number) => {
    setSelected((day) => addDays(day, days));
    // The grid re-renders around the new day; put the keyboard on it
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>("[aria-pressed=true]")?.focus());
  };

  const onKey = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    move(step);
  };

  const stepMonth = (months: number) => setSelected(new Date(selected.getFullYear(), selected.getMonth() + months, 1));

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <Button aria-label="Add a shift" icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
            <span className="hidden sm:inline">Add Shift</span>
          </Button>
        }
      />

      {/* With room, the month and the day sit side by side: pick a day on the left, read it on the right */}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <PeriodNav
            className="mb-3"
            label={monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            onPrevious={() => stepMonth(-1)}
            onNext={() => stepMonth(1)}
            onToday={isThisMonth ? undefined : () => setSelected(startOfDay(new Date()))}
          />

          <div className="surface overflow-hidden">
            <div aria-hidden className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground md:text-left">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-2 md:px-2.5">
                  {weekday}
                </span>
              ))}
            </div>
            {/* Arrow keys walk the days, like a date picker */}
            <div ref={grid} role="group" aria-label={`${monthName} days`} onKeyDown={onKey} className="grid grid-cols-7 gap-px bg-border">
              {cells.map((day) => {
                const isOn = isSameDay(day, selected);
                const isToday = isSameDay(day, new Date(now));
                const inMonth = day.getMonth() === monthStart.getMonth();
                const shifts = byDay.get(toCalendarDateString(day.toISOString())) ?? [];
                const colours = [...new Set(shifts.map((shift) => shift.job.color))];
                return (
                  <button
                    key={day.getTime()}
                    type="button"
                    aria-pressed={isOn}
                    tabIndex={isOn ? 0 : -1}
                    aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${shifts.length ? `, ${shifts.length} shift${shifts.length === 1 ? "" : "s"}` : ""}`}
                    onClick={() => setSelected(day)}
                    onDoubleClick={() => openSheet({ kind: "shift", date: day })}
                    className={`relative flex h-13 min-w-0 flex-col items-center gap-1 pt-1.5 text-sm tabular-nums transition-[background-color] duration-100 focus-visible:z-1 md:h-24 md:items-stretch md:gap-1 md:p-1.5 md:text-left xl:h-28 ${
                      isOn ? "bg-primary/10" : inMonth ? "bg-card pointer-fine:hover:bg-raised" : "bg-card/55"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm ${
                        isToday ? "bg-primary font-semibold text-primary-foreground" : isOn ? "font-semibold text-primary" : inMonth ? "" : "text-faint"
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {/* A phone has room for dots; a desktop names the shifts */}
                    <span aria-hidden className="flex h-1.5 gap-0.5 md:hidden">
                      {colours.slice(0, 3).map((colour) => (
                        <span key={colour} className="size-1.5 rounded-full" style={{ backgroundColor: colour }} />
                      ))}
                    </span>
                    <span aria-hidden className="hidden min-w-0 flex-col gap-0.5 md:flex">
                      {shifts.slice(0, CELL_SHIFTS).map((shift) => (
                        <span key={shift.id} className="flex min-w-0 items-center gap-1 rounded-[5px] px-1 py-px text-2xs" style={{ backgroundColor: `color-mix(in oklab, ${shift.job.color} 16%, transparent)` }}>
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: shift.job.color }} />
                          <span className="shrink-0 font-medium">{shortTime(shift.startTime)}</span>
                          <span className="truncate text-muted-foreground">{jobName(shift.job)}</span>
                        </span>
                      ))}
                      {shifts.length > CELL_SHIFTS && <span className="px-1 text-2xs text-muted-foreground">+{shifts.length - CELL_SHIFTS} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 hidden text-xs text-muted-foreground pointer-fine:block">Arrow keys move between days. Double-click a day to add a shift on it.</p>
        </div>

        <div className="flex min-w-0 flex-col gap-7 xl:sticky xl:top-24">
          <section aria-label="Selected day">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{formatDayLabel(selected, new Date(now))}</h2>
              {dayEnd > now && dayShifts.length > 0 && (
                <Button variant="ghost" size="sm" icon={<Plus aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
                  Add
                </Button>
              )}
            </div>
            {error ? (
              <LoadError message={error} onRetry={retry} />
            ) : data === null ? (
              <SkeletonRows rows={2} />
            ) : dayShifts.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-4">
                <p className="flex-1 text-sm text-muted-foreground">{dayEnd <= now ? "You had no shifts that day." : "Nothing on this day yet."}</p>
                {dayEnd > now && (
                  <Button variant="secondary" size="sm" icon={<Plus aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
                    Add Shift
                  </Button>
                )}
              </div>
            ) : (
              <ShiftList>
                {dayShifts.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} isNow={isHappeningNow(shift, now)} onClick={() => openSheet({ kind: "shift", shiftId: shift.id })} />
                ))}
              </ShiftList>
            )}
          </section>

          <PeriodSummary from={monthStart} to={monthEnd} title={`${monthName} in numbers`} />
        </div>
      </div>
    </>
  );
}
