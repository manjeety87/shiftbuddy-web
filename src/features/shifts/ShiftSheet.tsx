"use client";

import { ChevronRight, ClipboardList, CloudSun, Copy, Navigation, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TimeFields } from "@/components/TimeFields";
import { Button } from "@/components/ui/Button";
import { FormError, SectionLabel, TextArea } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { errorMessage } from "@/lib/api";
import { confirmOverlap, getOverlapConflicts } from "@/lib/conflicts";
import { formatTime } from "@/lib/dateUtils";
import { deleteShiftsWithUndo } from "@/lib/shiftActions";
import { confirmShortShift } from "@/lib/shiftDialogs";
import { createShift, getShiftById, updateShift } from "@/lib/shifts";
import { defaultShiftTimes, formatDuration, MIN_SHIFT_MINUTES, resolveShiftRange, toShiftTimes, withDuration, type ShiftTimes } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { useTimesheetChanged } from "@/lib/timesheet";
import { useMyJobs } from "@/lib/useMyJobs";
import { JobSelect } from "../jobs/JobSelect";

const MINUTE_MS = 60000;
const MAX_NOTES = 500;

// What "unchanged" means for the discard prompt: same job, same real start/end, same notes
const snapshot = (jobId: string | null, times: ShiftTimes, notes: string) => {
  const { startAt, endAt } = resolveShiftRange(times);
  return JSON.stringify({ jobId, start: startAt.toISOString(), end: endAt.toISOString(), notes: notes.trim() });
};

/** The hours clocked for a shift (open them to change them), or the way to add some. */
function HoursRow({ shift }: { shift: Shift }) {
  const entry = shift.timeEntries?.[0];
  const open = () => openSheet(entry ? { kind: "timeEntry", entryId: entry.id } : { kind: "timeEntry", shiftId: shift.id });
  const paid = entry?.clockOut ? Math.max(0, Math.round((Date.parse(entry.clockOut) - Date.parse(entry.clockIn)) / MINUTE_MS) - entry.breakMinutes) : null;

  return (
    <button type="button" onClick={open} className="surface flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left row-hover">
      {!entry ? (
        <>
          <Plus aria-hidden className="size-4 text-primary" />
          <span className="flex-1 text-sm font-medium text-primary">Add the hours you worked</span>
        </>
      ) : !entry.clockOut ? (
        <>
          <ClipboardList aria-hidden className="size-4 text-warning-ink" />
          <span className="flex-1 text-sm font-medium text-warning-ink">Still clocked in — set when you finished</span>
        </>
      ) : (
        <>
          <ClipboardList aria-hidden className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm text-muted-foreground tabular-nums">
            Worked {formatTime(entry.clockIn)} – {formatTime(entry.clockOut)}
            {entry.breakMinutes > 0 && ` · ${entry.breakMinutes} min break`}
          </span>
          <span className="text-sm font-semibold tabular-nums">{formatDuration(paid ?? 0)}</span>
        </>
      )}
      <ChevronRight aria-hidden className="size-4 text-faint" />
    </button>
  );
}

/** Add a shift (optionally on `date`), or change / delete one. */
export function ShiftSheet({ shiftId, date, onClose }: { shiftId?: string; date?: Date; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const { data: jobs } = useMyJobs();
  const [saved, setSaved] = useState<Shift | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [times, setTimes] = useState(() => defaultShiftTimes(date));
  const [notes, setNotes] = useState("");
  const [baseline, setBaseline] = useState<string | null>(() => (shiftId ? null : snapshot(null, defaultShiftTimes(date), "")));
  const [openedAt] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shiftId) return;
    getShiftById(shiftId)
      .then((shift) => {
        const loadedTimes = toShiftTimes(shift.startTime, shift.endTime);
        setSaved(shift);
        setSelectedJobId(shift.jobId);
        setTimes(loadedTimes);
        setNotes(shift.notes ?? "");
        setBaseline(snapshot(shift.jobId, loadedTimes, shift.notes ?? ""));
        setLoadError(null);
      })
      .catch((failure) => setLoadError(errorMessage(failure, "Couldn’t open this shift.")));
  }, [shiftId, attempt]);

  // Hours were added or changed in the sheet above this one: refresh the row, leave the form alone
  useTimesheetChanged(() => {
    if (shiftId) getShiftById(shiftId).then(setSaved).catch(() => undefined);
  });

  // With one job there is nothing to choose
  const jobId = selectedJobId ?? (jobs?.length === 1 ? jobs[0].id : null);
  const isLoaded = baseline !== null;

  const save = async () => {
    if (!jobId) return setError("Choose the job this shift is for.");
    let range = resolveShiftRange(times);
    if (range.durationMinutes === 24 * 60) return setError("Start and end are the same time.");
    setError(null);

    if (range.durationMinutes < MIN_SHIFT_MINUTES) {
      const choice = await confirmShortShift(range.durationMinutes);
      if (choice === "cancel") return;
      if (choice === "extend") {
        const extended = withDuration(times, MIN_SHIFT_MINUTES);
        setTimes(extended); // the form shows what was actually saved
        range = resolveShiftRange(extended);
      }
    }
    // Notes are always sent: on an edit an emptied field has to clear the saved note
    const input = { jobId, startTime: range.startAt.toISOString(), endTime: range.endAt.toISOString(), notes: notes.trim() };
    const send = (allowOverlap?: boolean) => (shiftId ? updateShift(shiftId, { ...input, allowOverlap }) : createShift({ ...input, allowOverlap }));

    setBusy("save");
    try {
      await send();
      sheet.current?.dismiss();
    } catch (failure) {
      const conflicts = getOverlapConflicts(failure);
      if (!conflicts) {
        setError(errorMessage(failure, "Couldn’t save this shift."));
      } else if (await confirmOverlap(conflicts)) {
        try {
          await send(true);
          sheet.current?.dismiss();
        } catch (retryFailure) {
          setError(errorMessage(retryFailure, "Couldn’t save this shift."));
        }
      }
      setBusy(null);
    }
  };

  // No "are you sure?" — it's deleted at once and the toast offers Undo
  const remove = async () => {
    if (!saved) return;
    setBusy("delete");
    if (await deleteShiftsWithUndo([saved])) sheet.current?.dismiss();
    else setBusy(null);
  };

  const hasStarted = saved && (Date.parse(saved.startTime) <= openedAt || !!saved.timeEntries?.length);

  return (
    <Sheet
      ref={sheet}
      title={shiftId ? "Edit Shift" : "New Shift"}
      onClose={onClose}
      isDirty={isLoaded && snapshot(selectedJobId, times, notes) !== baseline}
      action={isLoaded ? { label: shiftId ? "Save" : "Add", onClick: save, busy: busy === "save", disabled: busy === "delete" || !jobs || jobs.length === 0 } : undefined}
      cancelOnly={!isLoaded}
      footerStart={
        saved && (
          <Button variant="danger" icon={<Trash2 aria-hidden className="size-3.5" />} busy={busy === "delete"} disabled={busy === "save"} onClick={remove}>
            Delete
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
          {/* What you can look up about a saved shift sits above the form, apart from what changes it */}
          {saved && (
            <div className="mb-5 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Navigation aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "route", shiftId: saved.id })}>
                Route
              </Button>
              <Button variant="secondary" size="sm" icon={<CloudSun aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "weather", shiftId: saved.id })}>
                Weather
              </Button>
              <Button variant="secondary" size="sm" icon={<Copy aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "copy", shiftIds: [saved.id] })}>
                Copy
              </Button>
            </div>
          )}
          <FormError>{error}</FormError>
          <JobSelect jobs={jobs} value={jobId} onChange={setSelectedJobId} />
          <TimeFields value={times} onChange={setTimes} />
          <TextArea label="Notes" placeholder="Optional — e.g. closing shift" maxLength={MAX_NOTES} value={notes} onChange={(event) => setNotes(event.target.value)} />

          {saved && hasStarted && (
            <div className="mb-4">
              <SectionLabel>Hours worked</SectionLabel>
              <HoursRow shift={saved} />
            </div>
          )}

        </>
      )}
    </Sheet>
  );
}
