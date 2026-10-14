"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { selectClass } from "@/components/ui/Field";
import { TimePicker } from "@/components/ui/TimePicker";
import type { Job } from "@/interfaces/job.d";
import { formatDuration, resolveShiftRange, type ShiftTimes } from "@/lib/shiftTime";
import { jobOptionLabel } from "../jobs/JobSelect";

export interface Draft {
  key: number;
  jobId: string | null;
  times: ShiftTimes;
  notes?: string;
  needsReview: boolean;
}

// One set of columns for the header and every row. On a phone a row becomes two lines: day and job, then the times.
const COLUMNS = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_2rem] items-center gap-x-1 md:gap-x-2 gap-y-1.5 px-3 md:grid-cols-[9.5rem_minmax(0,1fr)_7.75rem_7.75rem_4.5rem_2rem]";

/**
 * The shifts read from a photo, as a table to check before anything is saved.
 * Cells look like plain text until pointed at — most rows are right and only
 * need a glance; a row the reader wasn't sure about is tinted and says so.
 */
export function ReviewTable({ drafts, jobs, onChange, onRemove }: { drafts: Draft[]; jobs: Job[] | null; onChange: (key: number, patch: Partial<Draft>) => void; onRemove: (key: number) => void }) {
  return (
    <div className="surface overflow-hidden">
      <div aria-hidden className={`${COLUMNS} hidden h-9 border-b border-border text-xs font-medium text-muted-foreground md:grid [&>span]:px-2.5`}>
        <span>Day</span>
        <span>Job</span>
        <span>Starts</span>
        <span>Ends</span>
        <span className="text-right">Length</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {drafts.map((draft, index) => {
          const range = resolveShiftRange(draft.times);
          const row = `Shift ${index + 1}`;
          return (
            <li key={draft.key} className={`py-2 md:py-1.5 ${draft.needsReview ? "bg-warning/10" : ""}`}>
              <div className={COLUMNS}>
                <DatePicker quiet label={`${row} day`} value={draft.times.date} onChange={(date) => onChange(draft.key, { times: { ...draft.times, date } })} />
                <select
                  aria-label={`${row} job`}
                  // A missing job is the one thing that blocks saving, so it never hides
                  className={`${selectClass} ${draft.jobId ? "quiet-field" : "shadow-[0_0_0_2px_var(--warning)]!"}`}
                  value={draft.jobId ?? ""}
                  onChange={(event) => onChange(draft.key, { jobId: event.target.value })}
                >
                  {!draft.jobId && <option value="">Choose a job</option>}
                  {jobs?.map((job) => (
                    <option key={job.id} value={job.id}>
                      {jobOptionLabel(job)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${row.toLowerCase()}`}
                  onClick={() => onRemove(draft.key)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-90 md:order-last pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
                <TimePicker quiet label={`${row} starts`} value={draft.times.start} onChange={(start) => onChange(draft.key, { times: { ...draft.times, start } })} />
                <TimePicker quiet label={`${row} ends`} value={draft.times.end} after={draft.times.start} onChange={(end) => onChange(draft.key, { times: { ...draft.times, end } })} />
                <span className="hidden px-2.5 text-right text-sm text-muted-foreground tabular-nums md:block">{formatDuration(range.durationMinutes)}</span>
              </div>
              {(draft.needsReview || draft.notes || range.isOvernight) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 px-5.5 pb-0.5 text-xs text-muted-foreground">
                  {draft.needsReview && (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <TriangleAlert aria-hidden className="size-3.5 text-warning-ink" /> Hard to read — please check this row
                    </span>
                  )}
                  {range.isOvernight && <span>Ends the next day</span>}
                  {draft.notes && <span className="truncate">{draft.notes}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
