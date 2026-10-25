"use client";

import { Plus } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { PeriodSummary } from "@/components/PeriodSummary";
import { featuresOf } from "@/lib/features";
import { isHappeningNow, ShiftList, ShiftRow, shortTime } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { getWeekDays, isSameDay, toCalendarDateString } from "@/lib/dateUtils";
import { addDays, formatDayLabel, startOfDay } from "@/lib/inputs";
import { jobName } from "@/lib/jobLabels";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { useIsWide } from "@/lib/preferences";
import { useUser } from "@/lib/session";
import { getMyShifts } from "@/lib/shifts";
import { openSheet, usePickedDay } from "@/lib/sheets";
import { useFetch } from "@/lib/useFetch";
import { useNow } from "@/lib/useNow";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How many shifts a day cell names before it says "+2 more" */
const CELL_SHIFTS = 2;

// The phone app's Calendar: a month, or one week when the month is too much to read
const VIEWS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
] as const;
const SUMMARY_PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function CalendarPage() {
  const now = useNow();
  const grid = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  usePickedDay(selected);
  // Week view is a phone thing, like the app; a wide screen always has room for the month
  const [phoneView, setPhoneView] = useState<"month" | "week">("month");
  const view = useIsWide() ? "month" : phoneView;
  const [summaryPeriod, setSummaryPeriod] = useState<"week" | "month">("month");
  // Settings › Customize can hide the hours-and-pay card
  const showSummary = featuresOf(useUser()).calendarSummary;

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  const weekStart = getWeekDays(selected)[0];
  const weekEnd = addDays(weekStart, 7);
  const gridStart = view === "week" ? weekStart : addDays(monthStart, -monthStart.getDay());
  const weeks = view === "week" ? 1 : Math.ceil((monthStart.getDay() + new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate()) / 7);
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
  const isThisWeek = isSameDay(weekStart, getWeekDays(new Date(now))[0]);

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
  const step = (direction: 1 | -1) => (view === "week" ? setSelected((day) => addDays(day, direction * 7)) : stepMonth(direction));

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <>
            <SegmentedControl label="Calendar view" options={VIEWS} value={phoneView} onChange={setPhoneView} className="w-32 md:hidden" />
            <Button aria-label="Add a shift" className="md:hidden" icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
              <span className="hidden sm:inline">Add Shift</span>
            </Button>
          </>
        }
      />

      {/* With room, the month and the day sit side by side: pick a day on the left, read it on the right */}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <PeriodNav
            className="mb-3"
            label={view === "week" ? `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}` : monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            onToday={(view === "week" ? isThisWeek : isThisMonth) ? undefined : () => setSelected(startOfDay(new Date()))}
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
                const inMonth = view === "week" || day.getMonth() === monthStart.getMonth();
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
                          <span className={`shrink-0 font-medium ${shift.missedReason ? "line-through opacity-65" : ""}`}>{shortTime(shift.startTime)}</span>
                          <span className={`truncate text-muted-foreground ${shift.missedReason ? "opacity-65" : ""}`}>{jobName(shift.job)}</span>
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
            <h2 className="mb-2.5 text-sm font-semibold">{formatDayLabel(selected, new Date(now))}</h2>
            {error ? (
              <LoadError message={error} onRetry={retry} />
            ) : data === null ? (
              <SkeletonRows rows={2} />
            ) : dayShifts.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-4">
                <p className="flex-1 text-sm text-muted-foreground">{dayEnd <= now ? "You had no shifts that day." : "Nothing on this day yet."}</p>
              </div>
            ) : (
              <ShiftList>
                {dayShifts.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} isNow={isHappeningNow(shift, now)} onClick={() => openSheet({ kind: "shift", shiftId: shift.id })} />
                ))}
              </ShiftList>
            )}
          </section>

          {showSummary && (
            <PeriodSummary
              from={summaryPeriod === "week" ? weekStart : monthStart}
              to={summaryPeriod === "week" ? weekEnd : monthEnd}
              title={summaryPeriod === "week" ? (isThisWeek ? "This week in numbers" : `Week of ${shortDate(weekStart)}`) : `${monthName} in numbers`}
              action={<SegmentedControl label="Summary period" options={SUMMARY_PERIODS} value={summaryPeriod} onChange={setSummaryPeriod} className="w-32" />}
            />
          )}
        </div>
      </div>
    </>
  );
}
