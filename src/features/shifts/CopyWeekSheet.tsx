"use client";

import { useRef, useState } from "react";
import { FormError } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import type { Shift } from "@/interfaces/shift.d";
import { errorMessage } from "@/lib/api";
import { addDays } from "@/lib/inputs";
import { createShiftsBulk } from "@/lib/shifts";
import { formatDuration, resolveShiftRange, toShiftTimes } from "@/lib/shiftTime";
import { useMyJobs } from "@/lib/useMyJobs";
import { ReviewTable, type Draft } from "../scan/ReviewTable";
import { announceCopy } from "./CopySheet";

const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * "Same shifts next week?" — the week's shifts moved on seven days, shown as the
 * same table a scan is checked in. Nothing is saved until Copy: next week is
 * rarely an exact repeat, so a time can be changed or a shift removed first.
 */
export function CopyWeekSheet({ shifts, weekStart, onClose }: { shifts: Shift[]; weekStart: Date; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const { data: jobs } = useMyJobs();
  // Seven days on by calendar date, not by 7 × 24 h, so a shift keeps its time of day across a DST change
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    shifts.map((shift, key) => {
      const times = toShiftTimes(shift.startTime, shift.endTime);
      return { key, jobId: shift.jobId, times: { ...times, date: addDays(times.date, 7) }, notes: shift.notes ?? undefined, needsReview: false };
    }),
  );
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (key: number, patch: Partial<Draft>) => {
    setTouched(true);
    setDrafts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const remove = (key: number) => {
    setTouched(true);
    setDrafts((rows) => rows.filter((row) => row.key !== key));
  };

  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      announceCopy(
        await createShiftsBulk(
          drafts.map((draft) => {
            const range = resolveShiftRange(draft.times);
            return { jobId: draft.jobId as string, startTime: range.startAt.toISOString(), endTime: range.endAt.toISOString(), notes: draft.notes };
          }),
        ),
      );
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t copy these shifts."));
      setBusy(false);
    }
  };

  const totalMinutes = drafts.reduce((total, draft) => total + resolveShiftRange(draft.times).durationMinutes, 0);

  return (
    <Sheet
      ref={sheet}
      title="Copy to Next Week"
      onClose={onClose}
      isDirty={touched}
      wide
      action={{ label: drafts.length === 0 ? "No shifts left" : `Copy ${drafts.length} Shift${drafts.length === 1 ? "" : "s"}`, onClick: copy, busy, disabled: drafts.length === 0 }}
    >
      <FormError>{error}</FormError>
      <p className="mb-4 text-sm text-pretty text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">
          {drafts.length} shift{drafts.length === 1 ? "" : "s"} · {formatDuration(totalMinutes)}
        </span>{" "}
        for {shortDate(addDays(weekStart, 7))} – {shortDate(addDays(weekStart, 13))}. Change a time or remove a shift you won’t work, then copy. Shifts that would clash are skipped.
      </p>
      <ReviewTable drafts={drafts} jobs={jobs} onChange={change} onRemove={remove} />
    </Sheet>
  );
}
