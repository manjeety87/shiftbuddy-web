"use client";

import { CalendarPlus, ChevronRight, Navigation, Plus, ScanLine, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { PeriodSummary } from "@/components/PeriodSummary";
import { formatShiftTimes, isHappeningNow, ShiftList, ShiftRow } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { errorMessage } from "@/lib/api";
import { getLeavePlan, summarizeLeavePlan } from "@/lib/commute";
import { getConflicts } from "@/lib/conflicts";
import { formatCountdown, formatTime, getWeekDays, isSameDay } from "@/lib/dateUtils";
import { addDays, formatDayLabel, startOfDay } from "@/lib/inputs";
import { jobName, jobRole } from "@/lib/jobLabels";
import { notify } from "@/lib/notify";
import { setPreference, useIsWide, usePreference } from "@/lib/preferences";
import { useUser } from "@/lib/session";
import { getIncomingShares, getSharedShifts } from "@/lib/shares";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { copyShifts, getMyShifts } from "@/lib/shifts";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { clockIn, CLOCK_IN_OPENS_MINUTES_BEFORE, clockOut, getCurrentEntry, useTimesheetChanged, type TimeEntry } from "@/lib/timesheet";
import { commuteLabel } from "@/lib/travelConflicts";
import { useFetch } from "@/lib/useFetch";
import { useNow } from "@/lib/useNow";
import { formatDegrees, getShiftWeather } from "@/lib/weather";
import { announceCopy } from "../shifts/CopySheet";
import { MonthBoard, PeopleFilter, WeekBoard, type BoardEntry, type BoardPerson } from "./ScheduleBoard";
import { ComingUpCard, TodayCard, type ComingUp, type PersonToday } from "./TodayCard";
import { WeatherGlyph } from "../weather/WeatherSheet";

const MINUTE_MS = 60000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
const VIEWS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

/** The id the people filter uses for your own shifts */
const ME = "me";
/** One colour per person who shares with you, in the order they come; yours is the theme's own */
const PERSON_COLOURS = ["#557a95", "#b0674a", "#866aa0", "#c29a45"];

/** How far ahead "next shift" looks for the people who share with you */
const LOOK_AHEAD_DAYS = 14;
/** How many shifts the "Coming up" list names */
const COMING_UP = 5;

/** Every schedule shared with you, for these days. Someone's being unavailable leaves them out; it never fails the page. */
const loadSharedSchedules = async (from: Date, to: Date) => {
  const shares = await getIncomingShares().catch(() => []);
  const lists = await Promise.all(shares.map((share) => getSharedShifts(share.owner.id, from.toISOString(), to.toISOString()).catch(() => null)));
  return lists.filter((list) => list !== null);
};

/** You have nothing coming up, but the page isn't empty (other people's shifts are on it): one quiet row, not a banner. */
function NoShiftsStrip() {
  return (
    <section aria-label="Your shifts" className="surface mb-7 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted/60 text-primary">
        <CalendarPlus className="size-4.5" />
      </span>
      <div className="min-w-48 flex-1">
        <h2 className="text-base font-semibold">You have no shifts coming up</h2>
        <p className="text-sm text-pretty text-muted-foreground">Add one yourself, or scan a photo of your schedule.</p>
      </div>
      <div className="flex gap-2">
        <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift" })}>
          Add Shift
        </Button>
        <Button variant="secondary" icon={<ScanLine aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "scan" })}>
          Scan Schedule
        </Button>
      </div>
    </section>
  );
}

const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

interface Issue {
  key: string;
  text: string;
  when: string;
  open: () => void;
}

/** While on the clock: where, since when, and the way to stop it. It arrives rather than pops — a state just changed. */
function ClockedInCard({ entry, now }: { entry: TimeEntry; now: number }) {
  const [busy, setBusy] = useState(false);
  const elapsed = Math.max(0, Math.round((now - Date.parse(entry.clockIn)) / MINUTE_MS));

  const stop = async () => {
    setBusy(true);
    try {
      const done = await clockOut();
      const paid = Math.max(0, Math.round((Date.parse(done.clockOut ?? done.clockIn) - Date.parse(done.clockIn)) / MINUTE_MS) - done.breakMinutes);
      notify.success(`Clocked out · ${formatDuration(paid)} paid`, {
        description: done.breakMinutes ? `${done.breakMinutes} min unpaid break taken off` : undefined,
        action: { label: "Edit", onPress: () => openSheet({ kind: "timeEntry", entryId: done.id }) },
      });
    } catch (failure) {
      notify.error("Couldn’t clock out", { description: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="On the clock"
      className="mb-5 flex items-center gap-4 rounded-[0.875rem] bg-primary px-5 py-4 text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.14)] transition-[opacity,scale] duration-300 ease-out starting:scale-[0.98] starting:opacity-0"
    >
      <span aria-hidden className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2.5 rounded-full bg-current" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold opacity-85">On the clock</p>
        <p className="truncate text-xl font-semibold">{jobName(entry.job)}</p>
      </div>
      <p className="hidden text-right text-sm tabular-nums opacity-90 sm:block">
        Since {formatTime(entry.clockIn)}
        <span className="block text-lg font-semibold opacity-100">{formatDuration(elapsed)}</span>
      </p>
      <Button variant="secondary" busy={busy} onClick={stop}>
        Clock Out
      </Button>
    </section>
  );
}

const statLabel = "text-xs text-muted-foreground";

/** The next shift on any day: when, how long until, the weather, when to leave, and the clock. */
function UpcomingShiftCard({ shift, now, isClockedIn }: { shift: Shift; now: number; isClockedIn: boolean }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const { data: plan } = useFetch(() => getLeavePlan(shift.id).catch(() => null), [shift.id, shift.startTime, user.commuteMode, user.arrivalBufferMinutes, user.homeLocation?.address]);
  const { data: weather } = useFetch(() => getShiftWeather(shift.id).catch(() => null), [shift.id, shift.startTime]);

  const start = Date.parse(shift.startTime);
  const hasStarted = start <= now;
  const opensAt = start - CLOCK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS;
  const role = jobRole(shift.job);
  const hasJobPin = shift.job.latitude != null;
  const canClockIn = !isClockedIn && now >= opensAt;

  const startClock = async () => {
    setBusy(true);
    try {
      await clockIn(shift.id);
      notify.success(`Clocked in at ${jobName(shift.job)}`);
    } catch (failure) {
      notify.error("Couldn’t clock in", { description: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Next shift" className="surface mb-7 overflow-hidden">
      <div className="flex items-start gap-4 p-5 lg:p-6">
        <button type="button" className="min-w-0 flex-1 rounded-lg text-left" onClick={() => openSheet({ kind: "shift", shiftId: shift.id })}>
          <span className="flex items-center gap-2 text-sm font-semibold text-primary">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: shift.job.color }} />
            {hasStarted ? "Now" : `Next shift · ${formatDayLabel(new Date(start), new Date(now))}`}
          </span>
          <span className="mt-1.5 line-clamp-2 text-3xl font-bold text-balance wrap-anywhere lg:text-4xl">{jobName(shift.job)}</span>
          <span className="mt-1 block text-base text-muted-foreground tabular-nums">
            {formatShiftTimes(shift)}
            {role && ` · ${role}`}
          </span>
        </button>
        {weather?.status === "ok" && (
          <button
            type="button"
            aria-label={`Weather: ${formatDegrees(weather.atStart.temperature)}, ${weather.atStart.conditionLabel}`}
            onClick={() => openSheet({ kind: "weather", shiftId: shift.id })}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm font-medium tabular-nums transition-[scale,background-color] duration-150 ease-out active:scale-95 pointer-fine:hover:bg-muted"
          >
            <WeatherGlyph hour={weather.atStart} className="size-4 text-primary" />
            {formatDegrees(weather.atStart.temperature)}
          </button>
        )}
      </div>

      {/* Three facts side by side: how long, when to leave, the clock */}
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="bg-card px-5 py-3.5 lg:px-6">
          <p className={statLabel}>{hasStarted ? "In progress" : "Starts in"}</p>
          <p className="text-lg font-semibold tabular-nums">{hasStarted ? `Ends ${formatTime(shift.endTime)}` : formatCountdown(shift.startTime)}</p>
        </div>

        <button
          type="button"
          onClick={() => openSheet(plan || (hasJobPin && user.homeLocation) ? { kind: "route", shiftId: shift.id } : hasJobPin ? { kind: "home" } : { kind: "job", jobId: shift.jobId })}
          className="order-last col-span-2 flex items-center gap-3 bg-card px-5 py-3.5 text-left row-hover sm:order-none sm:col-span-1 lg:px-6"
        >
          <span className="min-w-0 flex-1">
            <span className={`flex items-center gap-1.5 ${statLabel}`}>
              <Navigation aria-hidden className="size-3 text-primary" />
              {plan ? "Leave home by" : "Getting there"}
            </span>
            {plan ? (
              <>
                <span className="block text-lg font-semibold tabular-nums">{formatTime(plan.leaveAt)}</span>
                <span className="block truncate text-xs text-muted-foreground">{summarizeLeavePlan(plan)}</span>
              </>
            ) : (
              <span className="block text-sm font-medium text-pretty">
                {!hasJobPin ? "Add this job’s location to see when to leave" : !user.homeLocation ? "Add your home address to see when to leave" : "See the route"}
              </span>
            )}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
        </button>

        <div className="flex items-center bg-card px-5 py-3.5 lg:px-6">
          {canClockIn ? (
            <Button busy={busy} onClick={startClock} className="w-full md:h-9">
              Clock In
            </Button>
          ) : (
            <div>
              <p className={statLabel}>Clock</p>
              <p className="text-sm font-medium tabular-nums">{isClockedIn ? "You’re clocked in" : start - now < DAY_MS ? `Opens at ${formatTime(new Date(opensAt).toISOString())}` : `Opens ${CLOCK_IN_OPENS_MINUTES_BEFORE} min before`}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Issues({ issues, now, className = "" }: { issues: Issue[]; now: number; className?: string }) {
  if (issues.length === 0) return null;
  return (
    <section aria-label="Schedule problems" className={className}>
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        Needs a look
        <span className="rounded-full bg-warning/20 px-1.5 text-xs font-semibold tabular-nums">{issues.length}</span>
      </h2>
      <div className="surface divide-y divide-border overflow-hidden">
        {issues.map((issue) => (
          <button key={issue.key} type="button" onClick={issue.open} className="flex w-full items-start gap-3 px-3.5 py-3 text-left row-hover">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-pretty">{issue.text}</span>
              <span className="block text-xs text-muted-foreground">{formatDayLabel(new Date(issue.when), new Date(now))} · see how to fix it</span>
            </span>
            <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const user = useUser();
  const now = useNow();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [copying, setCopying] = useState(false);

  const days = getWeekDays(selected);
  const weekStart = days[0];
  const weekEnd = addDays(weekStart, 7);

  // A day early, so a shift that began last night and ends this morning is on screen

  // The month board is a wide-screen thing; a phone always reads one week
  const isWide = useIsWide();
  const savedView = usePreference("homeView");
  const view = isWide ? savedView : "week";
  const showShared = usePreference("sharedOnHome") === "on";
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  // What the calendar shows: this week, or the month's whole grid (it starts and ends on week edges)
  const rangeStart = view === "month" ? addDays(monthStart, -monthStart.getDay()) : weekStart;
  const rangeEnd = view === "month" ? addDays(monthEnd, (7 - monthEnd.getDay()) % 7) : weekEnd;

  const week = useFetch(() => getMyShifts({ from: addDays(rangeStart, -1).toISOString(), to: rangeEnd.toISOString() }), [rangeStart.getTime(), rangeEnd.getTime()]);
  // Schedules other people share with you, for the same days. Their being unavailable never breaks your own Home.
  const shared = useFetch(async () => (showShared ? loadSharedSchedules(addDays(rangeStart, -1), rangeEnd) : []), [rangeStart.getTime(), rangeEnd.getTime(), showShared]);
  // The same people around now, whatever the calendar is turned to: for "Today" and their next shift
  const nearby = useFetch(async () => (showShared ? loadSharedSchedules(new Date(Date.now() - DAY_MS), new Date(Date.now() + LOOK_AHEAD_DAYS * DAY_MS)) : []), [showShared]);
  // From a day back, so a shift already in progress is found; then keep the ones not over yet
  const upcoming = useFetch(() => getMyShifts({ from: new Date(Date.now() - DAY_MS).toISOString() }));
  const current = useFetch(getCurrentEntry);
  const conflicts = useFetch(() => getConflicts().catch(() => null));

  useShiftsChanged(() => {
    week.refetch();
    upcoming.refetch();
    conflicts.refetch();
  });
  useTimesheetChanged(current.refetch);

  const next = upcoming.data?.find((shift) => Date.parse(shift.endTime) > now) ?? null;
  const hasNothingUpcoming = upcoming.data !== null && !next;

  const dayStart = selected.getTime();
  const dayEnd = addDays(selected, 1).getTime();
  const dayShifts = week.data?.filter((shift) => Date.parse(shift.startTime) < dayEnd && Date.parse(shift.endTime) > dayStart) ?? [];
  // For copying and counting: only shifts that start inside this week (the list is padded by a day)
  const ownWeek = week.data?.filter((shift) => Date.parse(shift.startTime) >= weekStart.getTime() && Date.parse(shift.startTime) < weekEnd.getTime()) ?? [];

  const people: BoardPerson[] = shared.data?.length
    ? [{ id: ME, name: "You", colour: "var(--primary)", isYou: true }, ...shared.data.map((list, index) => ({ id: list.owner.id, name: list.owner.name.split(" ")[0], colour: PERSON_COLOURS[index % PERSON_COLOURS.length], isYou: false }))]
    : [];
  const shownPeople = people.filter((person) => !hidden.has(person.id));
  const entries: BoardEntry[] = [
    ...(hidden.has(ME)
      ? []
      : (week.data ?? [])
          .filter((shift) => Date.parse(shift.startTime) >= rangeStart.getTime())
          .map((shift) => ({ key: shift.id, personId: ME, startTime: shift.startTime, endTime: shift.endTime, name: jobName(shift.job), colour: shift.job.color, open: () => openSheet({ kind: "shift", shiftId: shift.id }) }))),
    ...(shared.data ?? [])
      .filter((list) => !hidden.has(list.owner.id))
      .flatMap((list) => {
        const owner = list.owner.name.split(" ")[0];
        return list.shifts.map((shift) => ({
          key: `${list.owner.id}-${shift.id}`,
          startTime: shift.startTime,
          endTime: shift.endTime,
          name: jobName(shift.job),
          colour: shift.job.color,
          personId: list.owner.id,
          open: () => openSheet({ kind: "shared", ownerId: list.owner.id, ownerName: owner, date: new Date(shift.startTime) }),
        }));
      }),
  ].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  // On a phone: what the others are doing on the chosen day, under your own shifts
  const othersToday = (shared.data ?? [])
    .filter((list) => !hidden.has(list.owner.id))
    .map((list) => ({ owner: list.owner, shifts: list.shifts.filter((shift) => Date.parse(shift.startTime) < dayEnd && Date.parse(shift.endTime) > dayStart) }))
    .filter((list) => list.shifts.length > 0);

  const togglePerson = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const isPastWeek = weekEnd.getTime() <= now;

  const copyWeek = async () => {
    setCopying(true);
    try {
      announceCopy(await copyShifts({ shiftIds: ownWeek.map((shift) => shift.id), offsetDays: 7 }));
    } catch (failure) {
      notify.error("Couldn’t copy the week", { description: errorMessage(failure) });
    } finally {
      setCopying(false);
    }
  };

  const issues: Issue[] = [
    ...(conflicts.data?.overlaps.map((pair) => ({ key: `o-${pair.first.id}-${pair.second.id}`, text: `${jobName(pair.first.job)} and ${jobName(pair.second.job)} overlap`, when: pair.first.startTime, open: () => openSheet({ kind: "conflict", conflict: "overlap", fromId: pair.first.id, toId: pair.second.id }) })) ?? []),
    ...(conflicts.data?.travel.map((pair) => ({
      key: `t-${pair.fromShift.id}-${pair.toShift.id}`,
      text: pair.severity === "late" ? `About ${pair.lateByMinutes} min late to ${jobName(pair.toShift.job)} by ${commuteLabel(pair.mode)}` : `Only ${pair.slackMinutes} min to spare getting to ${jobName(pair.toShift.job)}`,
      when: pair.toShift.startTime,
      open: () => openSheet({ kind: "conflict", conflict: "travel", fromId: pair.fromShift.id, toId: pair.toShift.id }),
    })) ?? []),
  ];

  const todayStart = startOfDay(new Date(now)).getTime();
  const isToday = (shift: { startTime: string; endTime: string }) => Date.parse(shift.startTime) < todayStart + DAY_MS && Date.parse(shift.endTime) > todayStart;
  // Only when someone shares with you: alone, the next-shift card already says all of this
  const todayPeople: PersonToday[] = nearby.data?.length
    ? [
        { id: ME, name: "You", colour: "var(--primary)", today: (upcoming.data ?? []).filter(isToday), next },
        ...nearby.data.map((list, index) => {
          const name = list.owner.name.split(" ")[0];
          return {
            id: list.owner.id,
            name,
            colour: PERSON_COLOURS[index % PERSON_COLOURS.length],
            today: list.shifts.filter(isToday),
            next: list.shifts.find((shift) => Date.parse(shift.endTime) > now) ?? null,
            open: () => openSheet({ kind: "shared", ownerId: list.owner.id, ownerName: name }),
          };
        }),
      ].filter((person) => !hidden.has(person.id))
    : [];
  // After today, everyone together — only worth a list when someone else's shifts are in it
  const comingUp: ComingUp[] = todayPeople.length
    ? [
        ...(hidden.has(ME) ? [] : (upcoming.data ?? []).map((shift) => ({ key: shift.id, startTime: shift.startTime, endTime: shift.endTime, name: jobName(shift.job), colour: shift.job.color, open: () => openSheet({ kind: "shift", shiftId: shift.id }) }))),
        ...(nearby.data ?? [])
          .filter((list) => !hidden.has(list.owner.id))
          .flatMap((list) => {
            const owner = list.owner.name.split(" ")[0];
            return list.shifts.map((shift) => ({
              key: `${list.owner.id}-${shift.id}`,
              startTime: shift.startTime,
              endTime: shift.endTime,
              name: jobName(shift.job),
              colour: shift.job.color,
              owner,
              open: () => openSheet({ kind: "shared", ownerId: list.owner.id, ownerName: owner, date: new Date(shift.startTime) }),
            }));
          }),
      ]
        .filter((entry) => Date.parse(entry.startTime) >= todayStart + DAY_MS)
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
        .slice(0, COMING_UP)
    : [];
  const weekLabel = `${shortDate(weekStart)} – ${shortDate(days[6])}`;
  const isThisWeek = days.some((day) => isSameDay(day, new Date(now)));
  const isThisMonth = monthStart.getFullYear() === new Date(now).getFullYear() && monthStart.getMonth() === new Date(now).getMonth();
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const addOn = (day: Date) => openSheet({ kind: "shift", date: day });

  return (
    <>
      <PageHeader
        eyebrow={new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting(new Date(now).getHours())}, ${user.name.split(" ")[0]}`}
        actions={
          // The empty card below already offers both; no need to say it twice
          !hasNothingUpcoming && (
            <>
              <Button variant="secondary" aria-label="Scan a schedule" icon={<ScanLine aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "scan" })}>
                <span className="hidden sm:inline">Scan</span>
              </Button>
              <Button aria-label="Add a shift" icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
                <span className="hidden sm:inline">Add Shift</span>
              </Button>
            </>
          )
        }
      />

      {current.data && <ClockedInCard entry={current.data} now={now} />}

      {/* The two things about right now, side by side: your next shift, and who is working today */}
      <div className={`mb-7 grid items-stretch gap-6 ${todayPeople.length ? "lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]" : ""}`}>
        <div className="flex min-w-0 flex-col *:mb-0! *:flex-1">
          {upcoming.error ? (
            <div className="mb-7">
              <LoadError message={upcoming.error} onRetry={upcoming.retry} />
            </div>
          ) : upcoming.data === null ? (
            <div className="mb-7">
              <SkeletonRows rows={1} className="h-44" />
            </div>
          ) : next ? (
            <UpcomingShiftCard shift={next} now={now} isClockedIn={!!current.data} />
          ) : nearby.data?.length ? (
            <NoShiftsStrip />
          ) : (
            <div className="mb-7">
              <EmptyState
                icon={CalendarPlus}
                title="No shifts coming up"
                action={
                  <>
                    <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift" })}>
                      Add Shift
                    </Button>
                    <Button variant="secondary" icon={<ScanLine aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "scan" })}>
                      Scan Schedule
                    </Button>
                  </>
                }
              >
                Add a shift yourself, or scan a photo of your schedule and we’ll read the shifts from it.
              </EmptyState>
            </div>
          )}

        </div>
        {/* A phone keeps one column for what matters most: the day strip and "Coming up" below already name everyone's shifts */}
        <TodayCard people={todayPeople} now={now} className="max-md:hidden" />
      </div>

      <Issues issues={issues} now={now} className="mb-7" />

          <section aria-label={view === "month" ? monthLabel : "This week"}>
            <div className="mb-3 flex items-center gap-3">
              {view === "month" ? (
                <PeriodNav
                  className="min-w-0 flex-1"
                  label={monthLabel}
                  onPrevious={() => setSelected(new Date(selected.getFullYear(), selected.getMonth() - 1, 1))}
                  onNext={() => setSelected(new Date(selected.getFullYear(), selected.getMonth() + 1, 1))}
                  onToday={isThisMonth ? undefined : () => setSelected(startOfDay(new Date()))}
                />
              ) : (
                <PeriodNav
                  className="min-w-0 flex-1"
                  label={weekLabel}
                  context={isThisWeek ? "This week" : undefined}
                  onPrevious={() => setSelected((day) => addDays(day, -7))}
                  onNext={() => setSelected((day) => addDays(day, 7))}
                  onToday={isThisWeek ? undefined : () => setSelected(startOfDay(new Date()))}
                />
              )}
              <div className="hidden w-36 shrink-0 md:block">
                <SegmentedControl label="Calendar view" options={VIEWS} value={savedView} onChange={(next) => setPreference("homeView", next)} />
              </div>
            </div>

            {people.length > 0 && <PeopleFilter people={people} hidden={hidden} onToggle={togglePerson} />}

            {week.error ? (
              <LoadError message={week.error} onRetry={week.retry} />
            ) : week.data === null ? (
              <SkeletonRows rows={1} className="h-52" />
            ) : (
              <>
                <div className="hidden md:block">
                  {view === "month" ? (
                    <MonthBoard
                      monthStart={monthStart}
                      people={shownPeople}
                      entries={entries}
                      now={now}
                      onAdd={addOn}
                      onOpenDay={(day) => {
                        // "+2 more": the week view has room for every shift of that day
                        setSelected(day);
                        setPreference("homeView", "week");
                      }}
                    />
                  ) : (
                    <WeekBoard days={days} people={shownPeople} entries={entries} now={now} onAdd={addOn} />
                  )}
                </div>

                {/* A phone can't fit seven columns: pick a day, then read it */}
                <div className="md:hidden">
                  <div role="group" aria-label="Day" className="mb-4 grid grid-cols-7 gap-1">
                    {days.map((day) => {
                      const isOn = isSameDay(day, selected);
                      const isToday = isSameDay(day, new Date(now));
                      // Everyone shown on the calendar: with people sharing, a dot is the person's colour (the chips above say whose); alone, the job's
                      const onDay = entries.filter((entry) => isSameDay(new Date(entry.startTime), day));
                      const colours = [...new Set(onDay.map((entry) => (people.length ? (people.find((person) => person.id === entry.personId)?.colour ?? entry.colour) : entry.colour)))].slice(0, 3);
                      return (
                        <button
                          key={day.getTime()}
                          type="button"
                          aria-pressed={isOn}
                          // The dots are drawn for the eye; the count is said for the ear
                          aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${onDay.length ? `, ${onDay.length} shift${onDay.length === 1 ? "" : "s"}` : ""}`}
                          onClick={() => setSelected(day)}
                          className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl tabular-nums transition-[scale,background-color] duration-150 ease-out active:scale-95 ${isOn ? "bg-card shadow-[0_0_0_1.5px_var(--primary)]" : ""}`}
                        >
                          <span className={`text-2xs ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                          <span className={`text-base ${isOn || isToday ? "font-semibold" : ""}`}>{day.getDate()}</span>
                          <span aria-hidden className="flex h-1.5 gap-0.5">
                            {colours.map((colour) => (
                              <span key={colour} className="size-1.5 rounded-full" style={{ backgroundColor: colour }} />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <h2 className="mb-2 text-sm font-semibold">{formatDayLabel(selected, new Date(now))}</h2>
                  {dayShifts.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-4">
                      <p className="flex-1 text-sm text-muted-foreground">{dayEnd <= now ? "You had no shifts that day." : `Nothing on ${selected.toLocaleDateString("en-US", { weekday: "long" })} yet.`}</p>
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
                  {othersToday.map((list) => (
                    <div key={list.owner.id} className="mt-4">
                      <h3 className="mb-2 text-sm font-semibold">{list.owner.name.split(" ")[0]}</h3>
                      <ShiftList>
                        {list.shifts.map((shift) => (
                          <ShiftRow key={shift.id} shift={shift} isNow={isHappeningNow(shift, now)} onClick={() => openSheet({ kind: "shared", ownerId: list.owner.id, ownerName: list.owner.name.split(" ")[0], date: new Date(shift.startTime) })} />
                        ))}
                      </ShiftList>
                    </div>
                  ))}
                </div>

                {view === "week" && ownWeek.length === 0 && !isPastWeek && <p className="mt-3 hidden text-sm text-muted-foreground md:block">You have nothing scheduled this week yet. Point at a day and press + to add a shift on it.</p>}
              </>
            )}
          </section>

      {/* What can wait sits under the calendar: what is next, the totals, and the copy shortcut */}
      <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ComingUpCard entries={comingUp} now={now} />

          {view === "month" ? (
            <PeriodSummary from={monthStart} to={monthEnd} title={`${monthStart.toLocaleDateString("en-US", { month: "long" })} in numbers`} />
          ) : (
            <PeriodSummary from={weekStart} to={weekEnd} title={isThisWeek ? "This week in numbers" : `${weekLabel} in numbers`} />
          )}

          {view === "week" && ownWeek.length > 0 && !isPastWeek && (
            <section aria-label="Copy this week" className="flex flex-col">
              <h2 className="mb-2.5 text-sm font-semibold">Same shifts next week?</h2>
              <div className="surface flex flex-1 flex-col items-start gap-3 p-4">
                <p className="text-sm text-pretty text-muted-foreground">
                  Copies {ownWeek.length === 1 ? "this week’s shift" : `these ${ownWeek.length} shifts`} to {shortDate(addDays(weekStart, 7))} – {shortDate(addDays(weekStart, 13))}. Shifts that would clash are skipped.
                </p>
                <Button variant="secondary" className="mt-auto" busy={copying} onClick={copyWeek}>
                  Copy
                </Button>
              </div>
            </section>
          )}
      </div>
    </>
  );
}
