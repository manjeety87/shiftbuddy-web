"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { JobSummary } from "@/interfaces/summary";
import { getWeekDays } from "@/lib/dateUtils";
import { addDays, formatMoney, startOfDay } from "@/lib/inputs";
import { useJobsChanged } from "@/lib/jobs";
import { jobName, jobRole } from "@/lib/jobLabels";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { getShiftsSummary } from "@/lib/shifts";
import { openSheet } from "@/lib/sheets";
import { useFetch } from "@/lib/useFetch";

type Period = "week" | "biweekly" | "month";

const PERIODS = [
  { value: "week", label: "Week" },
  { value: "biweekly", label: "2 Weeks" },
  { value: "month", label: "Month" },
] as const;

/**
 * Real calendar periods, as in the phone app's Pay Summary: a week starts on
 * Sunday like the calendar; "2 weeks" is this week and next, a typical biweekly
 * pay period; a month is the calendar month. `offset` steps back and forward.
 */
const periodRange = (period: Period, offset: number) => {
  const today = startOfDay(new Date());
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
  }
  const days = period === "week" ? 7 : 14;
  const start = addDays(getWeekDays(today)[0], offset * days);
  return { start, end: addDays(start, days) };
};

const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const rangeLabel = (period: Period, start: Date, end: Date) => (period === "month" ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : `${shortDate(start)} – ${shortDate(addDays(end, -1))}`);
const formatHours = (hours: number) => `${Math.round(hours * 10) / 10}h`;
const nameOf = (job: JobSummary) => ({ title: job.jobTitle, companyName: job.companyName });

/** Hours and estimated pay for a pay period, by job. The numbers are the backend's (`GET /shifts/summary`). */
export function PaySummarySheet({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("biweekly");
  const [offset, setOffset] = useState(0);

  const { start, end } = periodRange(period, offset);
  // The API's `to` is inclusive, so stop a millisecond before the next period
  const summary = useFetch(() => getShiftsSummary({ from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() }), [start.getTime(), end.getTime()]);
  // A shift added, or an hourly rate set, in a panel opened from here shows up straight away
  useShiftsChanged(summary.refetch);
  useJobsChanged(summary.refetch);

  const data = summary.data;
  const jobsWithoutRate = data?.byJob.filter((job) => !job.hourlyRate) ?? [];
  const workedShare = data && data.totalHours > 0 ? data.completedHours / data.totalHours : 0;

  return (
    <Sheet title="Pay Summary" onClose={onClose}>
      <SegmentedControl
        label="Pay period"
        options={PERIODS}
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setOffset(0);
        }}
        className="w-full"
      />

      <div className="my-3 flex items-center gap-2">
        <Button variant="quiet" size="sm" aria-label="Previous period" icon={<ChevronLeft aria-hidden className="size-4" />} onClick={() => setOffset((value) => value - 1)} />
        <div className="flex flex-1 flex-col items-center">
          <span className="text-sm font-semibold tabular-nums">{rangeLabel(period, start, end)}</span>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="text-xs font-medium text-primary">
              Back to now
            </button>
          )}
        </div>
        <Button variant="quiet" size="sm" aria-label="Next period" icon={<ChevronRight aria-hidden className="size-4" />} onClick={() => setOffset((value) => value + 1)} />
      </div>

      {summary.error && !data ? (
        <LoadError message={summary.error} onRetry={summary.retry} />
      ) : !data ? (
        <SkeletonRows rows={3} />
      ) : (
        <div key={`${period}-${offset}`} className="transition-opacity duration-200 ease-out starting:opacity-0">
          <div className="surface mb-3 p-4">
            <p className="text-sm text-muted-foreground">Total hours</p>
            <p className="text-3xl font-bold tabular-nums">{formatHours(data.totalHours)}</p>
            <p className="mb-2 text-xs text-muted-foreground">
              {data.shiftCount} shift{data.shiftCount === 1 ? "" : "s"}
              {data.missed.total > 0 && ` · ${data.missed.total} missed, not counted`}
            </p>
            {data.totalHours > 0 && (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(workedShare * 100)}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs tabular-nums">
                  <span className="font-medium text-primary">{formatHours(data.completedHours)} worked</span>
                  <span className="text-muted-foreground">{formatHours(data.upcomingHours)} still scheduled</span>
                </div>
              </>
            )}
          </div>

          {/* Pay: only jobs with an hourly rate can be counted */}
          <div className="surface mb-5 space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross pay</span>
              <span className="font-semibold tabular-nums">{formatMoney(data.totalGrossPay)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                Est. take-home
                <Link href="/settings#pay" onClick={onClose} className="inline-flex min-h-7 items-center rounded-md px-1.5 text-xs font-medium text-primary pointer-fine:hover:bg-hover" aria-label="Change the deduction estimate">
                  −{data.taxDeductionPercent}%
                </Link>
              </span>
              <span className="font-bold text-success tabular-nums">{formatMoney(data.totalNetPay)}</span>
            </div>
            {jobsWithoutRate.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {jobsWithoutRate.length === data.byJob.length ? "Add an hourly rate to your jobs to see pay." : `Doesn’t include ${jobsWithoutRate.map((job) => jobName(nameOf(job))).join(", ")} — no hourly rate yet.`}
              </p>
            )}
          </div>

          <SectionLabel>By job</SectionLabel>
          {data.byJob.length === 0 ? (
            <p className="surface p-4 text-sm text-muted-foreground">No shifts in this period.</p>
          ) : (
            <ul className="surface divide-y divide-border overflow-hidden">
              {[...data.byJob]
                .sort((a, b) => b.hours - a.hours)
                .map((job) => (
                  <JobRow key={job.jobId} job={job} />
                ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  const role = jobRole(nameOf(job));
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: job.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{jobName(nameOf(job))}</p>
        <p className="truncate text-xs text-muted-foreground">{[role, `${job.shiftCount} shift${job.shiftCount === 1 ? "" : "s"}`, formatHours(job.hours)].filter(Boolean).join(" · ")}</p>
      </div>
      {job.hourlyRate ? (
        <div className="text-right tabular-nums">
          <p className="text-sm font-semibold">{formatMoney(job.grossPay)}</p>
          <p className="text-xs text-muted-foreground">{formatMoney(job.hourlyRate)}/h</p>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => openSheet({ kind: "job", jobId: job.jobId })}>
          Add rate
        </Button>
      )}
    </li>
  );
}
