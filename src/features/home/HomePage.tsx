"use client";

import { Briefcase, CalendarPlus, ChevronRight, DoorOpen, Navigation, Plus, Repeat, ScanLine, Timer, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { PeriodSummary } from "@/components/PeriodSummary";
import { isHappeningNow, ShiftList, ShiftRow } from "@/components/ShiftRow";
import { Button, Spinner } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { errorMessage } from "@/lib/api";
import { getLeavePlan, summarizeLeavePlan, type StartChoice } from "@/lib/commute";
import { getConflicts } from "@/lib/conflicts";
import { formatCountdown, formatTime, getWeekDays, isSameDay } from "@/lib/dateUtils";
import { addDays, formatDayLabel, startOfDay } from "@/lib/inputs";
import { jobName, jobRole } from "@/lib/jobLabels";
import { notify } from "@/lib/notify";
import { setPreference, useIsWide, usePreference } from "@/lib/preferences";
import { useUser } from "@/lib/session";
import { getIncomingShares, getSharedShifts } from "@/lib/shares";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { getMyShifts } from "@/lib/shifts";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet, usePickedDay } from "@/lib/sheets";
import { featuresOf } from "@/lib/features";
import { clockIn, CLOCK_IN_OPENS_MINUTES_BEFORE, clockOut, getCurrentEntry, getUnloggedShifts, useTimesheetChanged, type TimeEntry } from "@/lib/timesheet";
import { commuteLabel } from "@/lib/travelConflicts";
import { useFetch } from "@/lib/useFetch";
import { useMyJobs } from "@/lib/useMyJobs";
import { useNow } from "@/lib/useNow";
import { formatDegrees, getShiftWeather } from "@/lib/weather";
import { GettingStarted } from "./GettingStarted";
import { MonthBoard, PeopleFilter, WeekBoard, type BoardEntry, type BoardPerson } from "./ScheduleBoard";
import { ComingUpCard, TodayCard, type ComingUp, type PersonToday } from "./TodayCard";
import { UnloggedHoursCard } from "./UnloggedHoursCard";
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
const RECENT_DAYS = 28;
/** How many shifts the "Coming up" list names */
const COMING_UP = 5;

/** Every schedule shared with you, for these days. Someone's being unavailable leaves them out; it never fails the page. */
const loadSharedSchedules = async (from: Date, to: Date) => {
  const shares = await getIncomingShares().catch(() => []);
  const lists = await Promise.all(shares.map((share) => getSharedShifts(share.owner.id, from.toISOString(), to.toISOString()).catch(() => null)));
  return lists.filter((list) => list !== null);
};

/**
 * Nothing coming up, but the page isn't empty — the week below has your earlier
 * shifts, or other people's: one quiet row, not the first-run banner. The banner
 * on a page full of shifts read as "you have no shifts at all" (the user, 2026-10-17).
 */
function NoShiftsStrip({ hadShifts }: { hadShifts: boolean }) {
  return (
    <section aria-label="Your shifts" className="surface mb-7 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted/60 text-primary">
        <CalendarPlus className="size-4.5" />
      </span>
      <div className="min-w-48 flex-1">
        <h2 className="text-base font-semibold">{hadShifts ? "No more shifts coming up" : "You have no shifts coming up"}</h2>
        <p className="text-sm text-pretty text-muted-foreground">{hadShifts ? "Add your next one, or scan your new schedule." : "Add one yourself, or scan a photo of your schedule."}</p>
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

/**
 * When to leave for the next shift, and from where. The backend starts from the
 * shift just before when there is one (you're already out — Boathouse, then the
 * shop across the mall), otherwise from home. "From home?" asks the what-if for
 * this shift only; the row's words cross-fade so the swap reads as one change.
 */
function LeaveRow({ shift, hasJobPin }: { shift: Shift; hasJobPin: boolean }) {
  const user = useUser();
  const [from, setFrom] = useState<StartChoice>("auto");
  // The shift before's name, kept for the "back" link while looking at home
  const [backTo, setBackTo] = useState<string | null>(null);
  const { data: plan, isLoading } = useFetch(
    () => getLeavePlan(shift.id, from).catch(() => null),
    [shift.id, from, shift.startTime, user.commuteMode, user.arrivalBufferMinutes, user.homeLocation?.address],
  );

  const kind = plan?.from.kind;
  const headline = !plan
    ? null
    : plan.sameBuilding
      ? `Same building — head over by ${formatTime(plan.arriveBy)}`
      : plan.leavesAsShiftEnds
        ? `Leave ${plan.from.name} as it ends, ${formatTime(plan.leaveAt)}`
        : kind === "previousShift"
          ? `Leave ${plan.from.name} by ${formatTime(plan.leaveAt)}`
          : `Leave home by ${formatTime(plan.leaveAt)}`;
  const detail = !plan
    ? null
    : plan.sameBuilding
      ? `After your ${plan.from.name} shift`
      : plan.lateMinutes > 0
        ? `${summarizeLeavePlan(plan)} · about ${plan.lateMinutes} min late`
        : summarizeLeavePlan(plan);
  // The other starting point, offered as a small what-if under the row
  const other = plan?.alternatives.includes("home") ? "home" : plan?.alternatives.includes("previousShift") ? "previousShift" : null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => openSheet(plan || (hasJobPin && user.homeLocation) ? { kind: "route", shiftId: shift.id, from } : hasJobPin ? { kind: "home" } : { kind: "job", jobId: shift.jobId })}
        className="flex min-h-14 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left ring-1 ring-primary-foreground/30 transition-[scale,background-color] duration-150 ease-out ring-inset active:scale-[0.98] pointer-fine:hover:bg-primary-well"
      >
        {plan ? <DoorOpen aria-hidden className="size-4.5 shrink-0" /> : <Navigation aria-hidden className="size-4.5 shrink-0" />}
        <span className="min-w-0 flex-1">
          {plan ? (
            // A new key per starting point: the words fade in (150 ms, a 2 px blur bridges old and new)
            <span key={`${kind}-${plan.leaveAt}`} className="block transition-[opacity,filter] duration-150 ease-out starting:opacity-0 starting:blur-[2px] motion-reduce:starting:blur-none">
              <span className="block text-[0.9375rem] font-semibold text-pretty tabular-nums">{headline}</span>
              <span className={`block truncate text-xs ${plan.lateMinutes > 0 ? "font-semibold" : ""}`}>{detail}</span>
            </span>
          ) : isLoading ? (
            <Spinner className="size-4" />
          ) : (
            <span className="block text-sm font-semibold text-pretty">
              {!hasJobPin ? "Pin this job on the map to see when to leave" : !user.homeLocation ? "Add your home address to see when to leave" : "Plan your route"}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden className="size-4.5 shrink-0 opacity-70" />
      </button>
      {other && (
        <button
          type="button"
          onClick={() => {
            if (other === "home" && plan) setBackTo(plan.from.name);
            setFrom(other);
          }}
          className="self-end rounded-md px-2 py-1.5 text-xs font-semibold underline-offset-2 transition-[scale] duration-150 ease-out active:scale-[0.97] pointer-fine:hover:underline"
        >
          {other === "home" ? "From home?" : `From ${backTo ?? "your shift before"}`}
        </button>
      )}
    </div>
  );
}

/** The next shift on any day: when, how long until, the weather, when to leave, and the clock. */
function UpcomingShiftCard({ shift, now, isClockedIn }: { shift: Shift; now: number; isClockedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const features = featuresOf(useUser());
  const { data: weather } = useFetch(() => (features.weather ? getShiftWeather(shift.id).catch(() => null) : Promise.resolve(null)), [shift.id, shift.startTime, features.weather]);

  const start = Date.parse(shift.startTime);
  const hasStarted = start <= now;
  const opensAt = start - CLOCK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS;
  const role = jobRole(shift.job);
  const hasJobPin = shift.job.latitude != null;
  const canClockIn = features.timesheet && !isClockedIn && now >= opensAt;

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

  const openShift = () => openSheet({ kind: "shift", shiftId: shift.id });
  const countdown = hasStarted ? `started ${formatTime(shift.startTime)}` : `starts in ${formatCountdown(shift.startTime)}`;
  const timeLabel = "text-xs font-medium";
  const timeValue = "text-xl font-bold tabular-nums sm:text-2xl";

  // Home's one loud element, filled with the theme colour like the phone app's card. Every word on it is full-strength
  // ink: a faded white on the accent drops under 4.5:1, so hierarchy comes from size and weight, and wells sit a step deeper.
  return (
    <section
      aria-label="Next shift"
      className="mb-7 rounded-[1.25rem] bg-primary p-5 text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_-16px_rgb(0_0_0/0.35)] sm:p-6 **:focus-visible:outline-primary-foreground"
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={openShift} className="min-w-0 flex-1 rounded-lg text-left transition-[scale] duration-150 ease-out active:scale-[0.99]">
          <span className="block text-xs font-semibold tracking-wide uppercase">{hasStarted ? "Your shift has started" : `Upcoming shift · ${formatDayLabel(new Date(start), new Date(now))}`}</span>
          <span className="mt-1 line-clamp-2 text-2xl font-bold text-balance wrap-anywhere sm:text-3xl lg:text-4xl">{jobName(shift.job)}</span>
          {role && <span className="mt-0.5 block truncate text-base">{role}</span>}
        </button>
        {/* The weather at the start, or the plain job icon until (or unless) there is one — the corner is never empty */}
        {weather?.status === "ok" ? (
          <button
            type="button"
            aria-label={`${formatDegrees(weather.atStart.temperature)}, ${weather.atStart.conditionLabel}. Opens the weather for this shift`}
            onClick={() => openSheet({ kind: "weather", shiftId: shift.id })}
            className="flex h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-primary-well px-3 text-lg font-bold tabular-nums transition-[scale,background-color] duration-150 ease-out active:scale-95 pointer-fine:hover:bg-primary-well-hover"
          >
            <WeatherGlyph hour={weather.atStart} className="size-5" />
            {formatDegrees(weather.atStart.temperature)}
          </button>
        ) : (
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-well">
            <Briefcase className="size-5.5" />
          </span>
        )}
      </div>

      {/* When it runs, when to leave, the clock: stacked on a phone, side by side when there's room */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pb-2 sm:col-span-2 lg:col-span-1 lg:pb-0">
          <p>
            <span className={`block ${timeLabel}`}>Starts</span>
            <span className={timeValue}>{formatTime(shift.startTime)}</span>
          </p>
          <span aria-hidden className="h-10 w-px bg-primary-foreground/25" />
          <p className="text-right">
            <span className={`block ${timeLabel}`}>Ends</span>
            <span className={timeValue}>{formatTime(shift.endTime)}</span>
          </p>
        </div>

        {/* Before the shift: when to leave, and from where. Once it has started there's nowhere to go — say when it ends */}
        {hasStarted || isClockedIn ? (
          <div className="flex min-h-14 items-center gap-2.5 rounded-xl px-3.5 py-2.5 ring-1 ring-primary-foreground/30 ring-inset">
            <Timer aria-hidden className="size-4.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold tabular-nums">Ends at {formatTime(shift.endTime)}</span>
              <span className="block truncate text-xs">{Date.parse(shift.endTime) > now ? `${formatCountdown(shift.endTime)} left` : "Finished"}</span>
            </span>
          </div>
        ) : features.leaveBy ? (
          // Keyed by shift: "From home?" is a what-if for this one shift, never carried to the next
          <LeaveRow key={shift.id} shift={shift} hasJobPin={hasJobPin} />
        ) : null}

        {canClockIn ? (
          // The card's one solid button: starting the clock is what the user is here for once the shift comes
          <button
            type="button"
            onClick={startClock}
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={`Clock in at ${jobName(shift.job)}`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-4 text-primary shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[scale,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
          >
            {busy ? <Spinner className="size-4.5" /> : <Timer aria-hidden className="size-4.5" />}
            <span className="text-base font-bold">Clock In</span>
            <span className="text-sm font-semibold tabular-nums">· {countdown}</span>
          </button>
        ) : !hasStarted || isClockedIn ? (
          <div className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-primary-well px-4 py-2 text-center">
            <p className="flex items-center gap-2 text-base font-bold tabular-nums">
              <Timer aria-hidden className="size-4.5" />
              {isClockedIn ? "You’re clocked in" : `Starts in ${formatCountdown(shift.startTime)}`}
            </p>
            {!isClockedIn && features.timesheet && <p className="text-xs tabular-nums">Clock in opens at {formatTime(new Date(opensAt).toISOString())}</p>}
          </div>
        ) : null}

        {/* Sick, called off…: marked here so the card moves on to the next shift */}
        {!isClockedIn && (
          <button type="button" onClick={() => openSheet({ kind: "missed", shiftId: shift.id })} className="self-center rounded-md px-2 py-1 text-sm font-semibold underline underline-offset-2 opacity-90 pointer-fine:hover:opacity-100">
            {hasStarted ? "Didn’t make it?" : "Can’t make it?"}
          </button>
        )}
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
  usePickedDay(selected);

  const days = getWeekDays(selected);
  const weekStart = days[0];
  const weekEnd = addDays(weekStart, 7);

  // A day early, so a shift that began last night and ends this morning is on screen

  // The month board is a wide-screen thing; a phone always reads one week
  const isWide = useIsWide();
  const savedView = usePreference("homeView");
  const view = isWide ? savedView : "week";
  const features = featuresOf(user);
  const showShared = features.sharedOnHome;
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
  // Only to word the "nothing coming up" card: someone with recent shifts isn't new here.
  // Not taken from the week on screen, so the card doesn't change as the week is turned.
  const recent = useFetch(() => getMyShifts({ from: new Date(Date.now() - RECENT_DAYS * DAY_MS).toISOString(), to: new Date().toISOString() }));
  const current = useFetch(getCurrentEntry);
  const conflicts = useFetch(() => getConflicts().catch(() => null));
  // Finished shifts nobody clocked ("Add your hours?"). Re-asked when the features change:
  // "Always add my hours" empties it on the backend.
  const unlogged = useFetch(() => (features.timesheet ? getUnloggedShifts().catch(() => []) : Promise.resolve([])), [features.timesheet, features.autoHours]);

  const jobs = useMyJobs();
  const welcomeSeen = usePreference("welcomeSeen");
  const guidePreference = usePreference("gettingStarted");

  // A brand-new account (no job yet) gets the welcome once on this browser. Marked seen
  // as it opens, so a re-render can't open a second one; people who already use the app never see it.
  useEffect(() => {
    if (jobs.data?.length !== 0 || welcomeSeen === "yes") return;
    setPreference("welcomeSeen", "yes");
    openSheet({ kind: "welcome" });
  }, [jobs.data?.length, welcomeSeen]);

  useShiftsChanged(() => {
    week.refetch();
    upcoming.refetch();
    recent.refetch();
    conflicts.refetch();
    unlogged.refetch();
  });
  useTimesheetChanged(() => {
    current.refetch();
    unlogged.refetch();
  });

  // Missed shifts never make the card: the user isn't going
  const next = upcoming.data?.find((shift) => !shift.missedReason && Date.parse(shift.endTime) > now) ?? null;
  const hasNothingUpcoming = upcoming.data !== null && !next;

  // Each step is read from the data, so a tick means it's really done
  const progress = {
    hasJob: !!jobs.data?.length,
    hasShift: !!(upcoming.data?.length || recent.data?.length || week.data?.length),
    // Steps for a feature that's switched off are left out (undefined)
    hasHome: features.leaveBy ? !!user.homeLocation : undefined,
    hasClockedIn: features.timesheet ? !!current.data || !!recent.data?.some((shift) => shift.timeEntries?.length) : undefined,
  };
  // Waits for everything it reads, so the card never appears and then vanishes
  const showGuide = guidePreference === "shown" && !Object.values(progress).every((done) => done !== false) && jobs.data !== null && upcoming.data !== null && recent.data !== null;

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
          .map((shift) => ({ key: shift.id, personId: ME, startTime: shift.startTime, endTime: shift.endTime, name: jobName(shift.job), colour: shift.job.color, missed: !!shift.missedReason, open: () => openSheet({ kind: "shift", shiftId: shift.id }) }))),
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
        { id: ME, name: "You", colour: "var(--primary)", today: (upcoming.data ?? []).filter((shift) => !shift.missedReason && isToday(shift)), next },
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
        ...(hidden.has(ME) ? [] : (upcoming.data ?? []).filter((shift) => !shift.missedReason).map((shift) => ({ key: shift.id, startTime: shift.startTime, endTime: shift.endTime, name: jobName(shift.job), colour: shift.job.color, open: () => openSheet({ kind: "shift", shiftId: shift.id }) }))),
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
              <Button aria-label="Add a shift" className="md:hidden" icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift", date: selected })}>
                <span className="hidden sm:inline">Add Shift</span>
              </Button>
            </>
          )
        }
      />

      {current.data && <ClockedInCard entry={current.data} now={now} />}

      {showGuide && <GettingStarted progress={progress} />}

      {/* The two things about right now, side by side: your next shift, and who is working today */}
      <div className={`mb-7 grid items-stretch gap-6 ${todayPeople.length ? "lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]" : ""}`}>
        <div className="flex min-w-0 flex-col *:mb-0! *:flex-1">
          {upcoming.error ? (
            <div className="mb-7">
              <LoadError message={upcoming.error} onRetry={upcoming.retry} />
            </div>
          ) : upcoming.data === null || (!next && recent.data === null && !recent.error) ? (
            // Waits for `recent` too when nothing is coming up, so the banner never flips to the strip
            <div className="mb-7">
              <SkeletonRows rows={1} className="h-44" />
            </div>
          ) : next ? (
            <UpcomingShiftCard shift={next} now={now} isClockedIn={!!current.data} />
          ) : recent.data?.length || nearby.data?.length ? (
            <NoShiftsStrip hadShifts={!!recent.data?.length} />
          ) : showGuide ? null : (
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

      {!!unlogged.data?.length && <UnloggedHoursCard items={unlogged.data} now={now} />}

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
          {/* A phone keeps Home to what the phone app's Home has; the totals live on Calendar and Pay Summary */}
          <div className="max-md:hidden md:contents">
            <ComingUpCard entries={comingUp} now={now} />

            {view === "month" ? (
              <PeriodSummary from={monthStart} to={monthEnd} title={`${monthStart.toLocaleDateString("en-US", { month: "long" })} in numbers`} showBreakdown={false} />
            ) : (
              <PeriodSummary from={weekStart} to={weekEnd} title={isThisWeek ? "This week in numbers" : `${weekLabel} in numbers`} showBreakdown={false} />
            )}
          </div>

          {view === "week" && ownWeek.length > 0 && !isPastWeek && (
            // The phone app's row: asked as a question, with what it does spelled out
            <div className="surface flex items-center gap-3 p-3.5 md:hidden">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Repeat className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Same shifts next week?</p>
                <p className="text-xs text-muted-foreground">
                  Copy {ownWeek.length === 1 ? "this shift" : `these ${ownWeek.length} shifts`} to {shortDate(addDays(weekStart, 7))} – {shortDate(addDays(weekStart, 13))}
                </p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Copy this week’s shifts to next week" onClick={() => openSheet({ kind: "copyWeek", shifts: ownWeek, weekStart })}>
                Copy
              </Button>
            </div>
          )}

          {view === "week" && ownWeek.length > 0 && !isPastWeek && (
            <section aria-label="Copy this week" className="flex flex-col max-md:hidden">
              <h2 className="mb-2.5 text-sm font-semibold">Same shifts next week?</h2>
              <div className="surface flex flex-1 flex-col items-start gap-3 p-4">
                <p className="text-sm text-pretty text-muted-foreground">
                  Copy {ownWeek.length === 1 ? "this week’s shift" : `these ${ownWeek.length} shifts`} to {shortDate(addDays(weekStart, 7))} – {shortDate(addDays(weekStart, 13))}. You’ll see them first, to change or remove any.
                </p>
                <Button variant="secondary" className="mt-auto" onClick={() => openSheet({ kind: "copyWeek", shifts: ownWeek, weekStart })}>
                  Review and Copy
                </Button>
              </div>
            </section>
          )}
      </div>
    </>
  );
}
