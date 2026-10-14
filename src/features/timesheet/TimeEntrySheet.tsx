"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TimeFields } from "@/components/TimeFields";
import { Button } from "@/components/ui/Button";
import { FormError, SectionLabel } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { errorMessage } from "@/lib/api";
import { showAlert } from "@/lib/dialog";
import { jobName } from "@/lib/jobLabels";
import { notify } from "@/lib/notify";
import { getShiftById } from "@/lib/shifts";
import { defaultShiftTimes, formatDuration, resolveShiftRange, toShiftTimes, type ShiftTimes } from "@/lib/shiftTime";
import { BREAK_CHOICES, createTimeEntry, deleteTimeEntry, getTimeEntry, updateTimeEntry, type TimeEntry } from "@/lib/timesheet";
import { useMyJobs } from "@/lib/useMyJobs";
import { JobSelect } from "../jobs/JobSelect";

// The same rule the backend applies at clock-out; the starting choice until the person picks a break
const usualBreak = (durationMinutes: number) => (durationMinutes > 5 * 60 ? 30 : 0);

const BREAK_OPTIONS = BREAK_CHOICES.map((minutes) => ({ value: String(minutes), label: minutes === 0 ? "None" : `${minutes} min` }));

/** A new entry starts as the most recent 9–5 that has already finished (hours can't be added for the future). */
const startingTimes = () => {
  const day = new Date();
  if (day.getHours() < 17) day.setDate(day.getDate() - 1);
  return defaultShiftTimes(day);
};

const snapshot = (jobId: string | null, times: ShiftTimes, breakMinutes: number) => {
  const { startAt, endAt } = resolveShiftRange(times);
  return JSON.stringify({ jobId, start: startAt.toISOString(), end: endAt.toISOString(), breakMinutes });
};

/**
 * One timesheet entry. With `entryId` it fixes what the clock recorded (forgot to
 * clock out, the shift ran long); with `shiftId` it adds hours for that shift,
 * starting from its scheduled times; otherwise it adds hours by hand for a job.
 */
export function TimeEntrySheet({ entryId, shiftId, jobId: startJobId, onClose }: { entryId?: string; shiftId?: string; jobId?: string; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const isNew = !entryId;
  const { data: jobs } = useMyJobs();
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [shiftJob, setShiftJob] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(startJobId ?? null);
  const [times, setTimes] = useState<ShiftTimes>(startingTimes);
  // null = not chosen yet: follow the usual break for the entry's length
  const [chosenBreak, setChosenBreak] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<string | null>(() => {
    if (entryId || shiftId) return null; // set once the entry or shift has loaded
    const start = startingTimes();
    return snapshot(startJobId ?? null, start, usualBreak(resolveShiftRange(start).durationMinutes));
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const failed = (failure: unknown) => setLoadError(errorMessage(failure, "Couldn’t open these hours."));
    if (entryId) {
      getTimeEntry(entryId)
        .then((loaded) => {
          // Still on the clock: the form starts with "until now", and saving clocks out at the chosen time
          const loadedTimes = toShiftTimes(loaded.clockIn, loaded.clockOut ?? new Date().toISOString());
          setEntry(loaded);
          setTimes(loadedTimes);
          setChosenBreak(loaded.breakMinutes);
          setBaseline(snapshot(loaded.jobId, loadedTimes, loaded.breakMinutes));
          setLoadError(null);
        })
        .catch(failed);
    } else if (shiftId) {
      getShiftById(shiftId)
        .then((shift) => {
          const shiftTimes = toShiftTimes(shift.startTime, shift.endTime);
          setSelectedJobId(shift.jobId);
          setShiftJob(jobName(shift.job));
          setTimes(shiftTimes);
          setBaseline(snapshot(shift.jobId, shiftTimes, usualBreak(resolveShiftRange(shiftTimes).durationMinutes)));
          setLoadError(null);
        })
        .catch(failed);
    }
  }, [entryId, shiftId, attempt]);

  const jobId = entry?.jobId ?? selectedJobId ?? (jobs?.length === 1 ? jobs[0].id : null);
  const range = resolveShiftRange(times);
  const breakMinutes = chosenBreak ?? usualBreak(range.durationMinutes);
  const paidMinutes = Math.max(0, range.durationMinutes - breakMinutes);
  const isLoaded = baseline !== null;

  const save = async () => {
    if (!jobId) return setError("Choose the job these hours were for.");
    if (range.endAt.getTime() > Date.now()) return setError("These hours end in the future. Hours can only be added once they’re worked.");
    if (breakMinutes >= range.durationMinutes) return setError("The break is as long as the hours themselves.");
    setBusy("save");
    setError(null);
    const body = { clockIn: range.startAt.toISOString(), clockOut: range.endAt.toISOString(), breakMinutes };
    try {
      if (entryId) await updateTimeEntry(entryId, body);
      else await createTimeEntry(shiftId ? { shiftId, ...body } : { jobId, ...body });
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, isNew ? "Couldn’t add these hours." : "Couldn’t save these hours."));
      setBusy(null);
    }
  };

  const remove = () => {
    if (!entryId) return;
    showAlert("Delete these hours?", "They come off your timesheet. Your scheduled shift stays.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await deleteTimeEntry(entryId);
            notify.success("Hours deleted");
            sheet.current?.dismiss();
          } catch (failure) {
            setError(errorMessage(failure, "Couldn’t delete these hours."));
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Sheet
      ref={sheet}
      title={entry ? jobName(entry.job) : (shiftJob ?? "Add Hours")}
      onClose={onClose}
      isDirty={isLoaded && snapshot(entry?.jobId ?? selectedJobId, times, breakMinutes) !== baseline}
      action={isLoaded ? { label: isNew ? "Add" : "Save", onClick: save, busy: busy === "save", disabled: busy === "delete" || !jobs || jobs.length === 0 } : undefined}
      cancelOnly={!isLoaded}
      footerStart={
        entryId &&
        isLoaded && (
          <Button variant="danger" icon={<Trash2 aria-hidden className="size-3.5" />} busy={busy === "delete"} disabled={busy === "save"} onClick={remove}>
            Delete Hours
          </Button>
        )
      }
    >
      {loadError ? (
        <LoadError message={loadError} onRetry={() => setAttempt((count) => count + 1)} />
      ) : !isLoaded ? (
        <SkeletonRows rows={3} className="h-14" />
      ) : (
        <>
          <FormError>{error}</FormError>
          {shiftId ? (
            <p className="mb-4 text-sm text-muted-foreground">These start as your scheduled times. Change them to what you actually worked.</p>
          ) : isNew ? (
            <JobSelect jobs={jobs} value={jobId} onChange={setSelectedJobId} />
          ) : (
            !entry?.clockOut && <p className="mb-4 text-sm text-muted-foreground">You’re still clocked in. Set when you finished and save to clock out at that time.</p>
          )}

          <TimeFields value={times} onChange={setTimes} maxDate={new Date()} />

          <SectionLabel className="mb-1.5 font-medium!">Unpaid break</SectionLabel>
          <SegmentedControl label="Unpaid break" className="mb-5" options={BREAK_OPTIONS} value={String(breakMinutes)} onChange={(value) => setChosenBreak(Number(value))} />

          <div className="surface flex items-center px-4 py-3">
            <span className="flex-1 text-sm text-muted-foreground">Paid time</span>
            <span className="text-lg font-semibold tabular-nums">{formatDuration(paidMinutes)}</span>
          </div>

        </>
      )}
    </Sheet>
  );
}
