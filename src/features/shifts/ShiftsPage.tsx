"use client";

import { CalendarClock, CheckSquare, ChevronRight, Copy, DollarSign, Plus, ScanLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatShiftTimes, isHappeningNow, NowBadge, shiftMinutes } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { selectClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Checkbox, SelectionHeader } from "@/components/ui/SelectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { formatTime, getWeekDays, toCalendarDateString } from "@/lib/dateUtils";
import { addDays, formatDayLabel } from "@/lib/inputs";
import { jobName, jobRole } from "@/lib/jobLabels";
import { deleteShiftsWithUndo } from "@/lib/shiftActions";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { getMyShifts } from "@/lib/shifts";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { useTimesheetChanged } from "@/lib/timesheet";
import { useFetch } from "@/lib/useFetch";
import { useEscapeToStop, useLongPress } from "@/lib/useLongPress";
import { useNow } from "@/lib/useNow";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_DAYS = 90;

const VIEWS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

// One set of columns for the header and every row, so the table lines up. On a
// phone the day and time fold into the job cell and only the length stays beside it.
// The last column holds the chevron, or the checkbox while selecting: same width, so nothing moves.
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-4 px-4 md:grid-cols-[8.5rem_minmax(0,1.3fr)_11.5rem_4.5rem_minmax(0,1fr)_1.25rem]";

const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const weekLabel = (weekStart: Date, now: number) => {
  const thisWeek = getWeekDays(new Date(now))[0].getTime();
  const weeks = Math.round((weekStart.getTime() - thisWeek) / (7 * DAY_MS));
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Next week";
  if (weeks === -1) return "Last week";
  return `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`;
};

/** The hours clocked for a finished shift. Only where hours exist — adding them lives in the shift itself. */
const workedText = (shift: Shift) => {
  const entry = shift.timeEntries?.[0];
  if (!entry) return null;
  if (!entry.clockOut) return { text: "Still clocked in — open to set when you finished", isOpen: true };
  const paid = Math.max(0, Math.round((Date.parse(entry.clockOut) - Date.parse(entry.clockIn)) / 60000) - entry.breakMinutes);
  return { text: `Worked ${formatTime(entry.clockIn)} – ${formatTime(entry.clockOut)} · ${formatDuration(paid)} paid`, isOpen: false };
};

export function ShiftsPage() {
  const now = useNow();
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [jobId, setJobId] = useState("all");
  // Several shifts at once, to clear a week copied by mistake, say
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Upcoming is asked for from a day back, so a shift in progress is included; past is the last 90 days
  const { data, error, retry, refetch } = useFetch(
    () => (view === "upcoming" ? getMyShifts({ from: new Date(Date.now() - DAY_MS).toISOString() }) : getMyShifts({ from: new Date(Date.now() - PAST_DAYS * DAY_MS).toISOString(), to: new Date().toISOString() })),
    [view],
  );
  useShiftsChanged(refetch);
  useTimesheetChanged(refetch);

  const inView = data?.filter((shift) => (view === "upcoming" ? Date.parse(shift.endTime) > now : Date.parse(shift.endTime) <= now)) ?? [];
  if (view === "past") inView.reverse(); // newest first

  const jobs = [...new Map(inView.map((shift) => [shift.jobId, shift.job])).values()];
  // A job that has left the list (its last shift was deleted) can't stay selected
  const filter = jobs.some((job) => job.id === jobId) ? jobId : "all";
  const shown = filter === "all" ? inView : inView.filter((shift) => shift.jobId === filter);

  // Only what is on screen can be deleted: a pick the job filter has hidden stays out
  const pickedShifts = shown.filter((shift) => picked.has(shift.id));

  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (ids: string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const press = useLongPress((id) => {
    setSelecting(true);
    toggle([id], true);
  });

  useEscapeToStop(selecting, stopSelecting);

  // Deletes at once with Undo, like a single shift: a mis-tap costs one tap to fix
  const deletePicked = async () => {
    setDeleting(true);
    const deleted = await deleteShiftsWithUndo(pickedShifts);
    setDeleting(false);
    if (deleted) stopSelecting();
  };

  const groups: { key: number; weekStart: Date; shifts: Shift[] }[] = [];
  shown.forEach((shift) => {
    const weekStart = getWeekDays(new Date(shift.startTime))[0];
    const last = groups[groups.length - 1];
    if (last?.key === weekStart.getTime()) last.shifts.push(shift);
    else groups.push({ key: weekStart.getTime(), weekStart, shifts: [shift] });
  });

  const totalMinutes = shown.reduce((total, shift) => total + shiftMinutes(shift), 0);

  const showsEmptyState = !error && data !== null && groups.length === 0 && view === "upcoming";
  const allPicked = shown.length > 0 && pickedShifts.length === shown.length;

  const copyPicked = () => {
    openSheet({ kind: "copy", shiftIds: pickedShifts.map((shift) => shift.id) });
    stopSelecting();
  };

  return (
    <>
      {selecting ? (
        <SelectionHeader count={pickedShifts.length} onDone={stopSelecting}>
          <Button variant="quiet" aria-label={allPicked ? "Deselect all" : "Select all"} icon={<CheckSquare aria-hidden className="size-4" />} onClick={() => (allPicked ? setPicked(new Set()) : toggle(shown.map((shift) => shift.id), true))}>
            <span className="hidden sm:inline">{allPicked ? "Deselect all" : "Select all"}</span>
          </Button>
          <Button variant="secondary" aria-label="Copy selected shifts" icon={<Copy aria-hidden className="size-4" />} disabled={pickedShifts.length === 0} onClick={copyPicked}>
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <Button variant="danger" aria-label="Delete selected shifts" icon={<Trash2 aria-hidden className="size-4" />} busy={deleting} disabled={pickedShifts.length === 0} onClick={deletePicked}>
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </SelectionHeader>
      ) : (
        <PageHeader
          title="Shifts"
          actions={
            <>
              <Button variant="secondary" aria-label="Pay summary" icon={<DollarSign aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "paySummary" })}>
                <span className="hidden sm:inline">Pay</span>
              </Button>
              {/* The empty state below already offers Scan and Add; no need to say it twice */}
              {!showsEmptyState && (
                <>
                  <Button variant="secondary" aria-label="Scan a schedule" icon={<ScanLine aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "scan" })}>
                    <span className="hidden sm:inline">Scan</span>
                  </Button>
                  <Button aria-label="Add a shift" className="md:hidden" icon={<Plus aria-hidden className="size-4" />} onClick={() => openSheet({ kind: "shift" })}>
                    <span className="hidden sm:inline">Add Shift</span>
                  </Button>
                </>
              )}
            </>
          }
        />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Which shifts"
          options={VIEWS}
          value={view}
          onChange={(next) => {
            stopSelecting();
            setView(next);
          }}
          className="w-full sm:w-56"
        />
        {jobs.length > 1 && (
          <select aria-label="Show shifts for" value={filter} onChange={(event) => setJobId(event.target.value)} className={`${selectClass} min-w-0 flex-1 sm:w-auto! sm:flex-none`}>
            <option value="all">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {jobName(job)}
              </option>
            ))}
          </select>
        )}
        {shown.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {shown.length} shift{shown.length === 1 ? "" : "s"} · {formatDuration(totalMinutes)}
            </p>
            {/* Touch screens can also press and hold a row; ✕ in the header ends selecting */}
            {!selecting && (
              <Button variant="quiet" size="sm" onClick={() => setSelecting(true)}>
                Select
              </Button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : data === null ? (
        <SkeletonRows rows={5} className="h-12" />
      ) : groups.length === 0 ? (
        view === "upcoming" ? (
          <EmptyState
            icon={CalendarClock}
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
            Add a shift yourself, or scan a photo of your schedule.
          </EmptyState>
        ) : (
          <EmptyState icon={CalendarClock} title="No past shifts">
            Shifts from the last {PAST_DAYS} days show here once they’re over.
          </EmptyState>
        )
      ) : (
        <div className="surface overflow-hidden">
          <div aria-hidden className={`${COLUMNS} hidden h-9 border-b border-border text-xs font-medium text-muted-foreground md:grid`}>
            <span>Day</span>
            <span>Job</span>
            <span>Time</span>
            <span className="text-right">Length</span>
            <span>{view === "past" ? "Hours worked" : "Notes"}</span>
            <span />
          </div>

          {groups.map((group) => (
            <section key={group.key} aria-label={weekLabel(group.weekStart, now)}>
              <h2 className="flex h-8 items-center gap-3 border-b border-border bg-muted/35 px-4 text-xs font-semibold">
                <span className="flex-1">{weekLabel(group.weekStart, now)}</span>
                <span className="font-medium text-muted-foreground tabular-nums">{formatDuration(group.shifts.reduce((total, shift) => total + shiftMinutes(shift), 0))}</span>
                {selecting && <WeekToggle shifts={group.shifts} picked={picked} onToggle={toggle} />}
              </h2>
              <ul className="divide-y divide-border">
                {group.shifts.map((shift, index) => {
                  const day = formatDayLabel(new Date(shift.startTime), new Date(now));
                  const startsDay = index === 0 || toCalendarDateString(group.shifts[index - 1].startTime) !== toCalendarDateString(shift.startTime);
                  const role = jobRole(shift.job);
                  const worked = view === "past" ? workedText(shift) : null;
                  const aside = worked?.text ?? (view === "upcoming" ? shift.notes : null);
                  const isPicked = picked.has(shift.id);
                  return (
                    <li key={shift.id}>
                      <button
                        type="button"
                        role={selecting ? "checkbox" : undefined}
                        aria-checked={selecting ? isPicked : undefined}
                        {...press.bind(shift.id)}
                        onClick={() => {
                          if (press.consumeLongPress()) return;
                          if (selecting) toggle([shift.id], !isPicked);
                          else openSheet({ kind: "shift", shiftId: shift.id });
                        }}
                        className={`${COLUMNS} w-full py-3 text-left select-none row-hover [-webkit-touch-callout:none] md:py-2.5 ${isPicked ? "bg-primary/8" : ""}`}
                      >
                        {/* The day is written once per day, like a ledger: repeats would only add noise */}
                        <span className={`hidden text-sm tabular-nums md:block ${startsDay ? "font-medium" : "text-transparent"}`}>{day}</span>

                        <span className="flex min-w-0 items-center gap-3">
                          <span aria-hidden className="h-8 w-1 shrink-0 rounded-full md:size-2" style={{ backgroundColor: shift.job.color }} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-base font-medium md:text-sm">{jobName(shift.job)}</span>
                              {isHappeningNow(shift, now) && <NowBadge />}
                            </span>
                            {role && <span className="hidden truncate text-xs text-muted-foreground md:block">{role}</span>}
                            <span className="block truncate text-sm text-muted-foreground tabular-nums md:hidden">
                              {day} · {formatShiftTimes(shift)}
                            </span>
                            {aside && <span className={`block truncate text-xs md:hidden ${worked?.isOpen ? "font-medium text-warning-ink" : "text-muted-foreground"}`}>{aside}</span>}
                          </span>
                        </span>

                        <span className="hidden text-sm tabular-nums md:block">{formatShiftTimes(shift)}</span>
                        <span className="text-right text-sm text-muted-foreground tabular-nums">{formatDuration(shiftMinutes(shift))}</span>
                        <span className={`hidden truncate text-sm md:block ${worked?.isOpen ? "font-medium text-warning-ink" : "text-muted-foreground"}`}>{aside ?? "—"}</span>
                        {selecting ? <Checkbox checked={isPicked} /> : <ChevronRight aria-hidden className="size-4 text-faint" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

    </>
  );
}

/** Pick or clear a whole week in one go: a week copied by mistake is the usual reason to select. */
function WeekToggle({ shifts, picked, onToggle }: { shifts: Shift[]; picked: ReadonlySet<string>; onToggle: (ids: string[], on: boolean) => void }) {
  const allPicked = shifts.every((shift) => picked.has(shift.id));
  return (
    <button type="button" onClick={() => onToggle(shifts.map((shift) => shift.id), !allPicked)} className="-mr-2 flex h-8 items-center rounded-md px-2 font-medium text-primary pointer-fine:hover:bg-hover">
      {allPicked ? "Clear week" : "Select week"}
    </button>
  );
}
