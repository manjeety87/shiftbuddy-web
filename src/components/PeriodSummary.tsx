"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/inputs";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { getShiftsSummary } from "@/lib/shifts";
import { useFetch } from "@/lib/useFetch";

const formatHours = (hours: number) => `${Math.round(hours * 10) / 10}h`;

/**
 * A week's or month's schedule as totals: shifts, hours, estimated pay, and the
 * split by job. Hidden when the period has no shifts — an all-zero card says nothing.
 * The numbers are the backend's (`GET /shifts/summary`), the same ones the phone shows.
 * Home passes `showBreakdown={false}`: the worked / still-to-come / take-home line lives
 * on the Calendar, so Home stays a glance (the user's call, 2026-10-17).
 * With an `action` (the Calendar's Week/Month switch) an empty period still shows,
 * saying so, because hiding it would take the switch away too.
 */
export function PeriodSummary({ from, to, title, showBreakdown = true, action }: { from: Date; to: Date; title: string; showBreakdown?: boolean; action?: ReactNode }) {
  const { data, refetch } = useFetch(() => getShiftsSummary({ from: from.toISOString(), to: to.toISOString() }), [from.getTime(), to.getTime()]);
  useShiftsChanged(refetch);
  if (!data || (data.shiftCount === 0 && !action)) return null;

  const mostHours = Math.max(...data.byJob.map((job) => job.hours), 1);
  const hasPay = data.totalGrossPay > 0;

  return (
    <section aria-label={title} className="flex flex-col">
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {data.shiftCount === 0 ? (
        <p className="surface p-4 text-sm text-muted-foreground">No shifts in this period yet.</p>
      ) : (
        <div className="surface flex-1 p-4">
          <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-5">
            <div>
              <dt className="text-xs text-muted-foreground">Shifts</dt>
              <dd className="text-xl font-semibold tabular-nums">{data.shiftCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Hours</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatHours(data.totalHours)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Est. pay</dt>
              <dd className="truncate text-xl font-semibold tabular-nums">{hasPay ? formatMoney(data.totalGrossPay) : "—"}</dd>
            </div>
          </dl>
          {showBreakdown ? (
            <p className="mt-2 text-xs text-pretty text-muted-foreground tabular-nums">
              {formatHours(data.completedHours)} worked · {formatHours(data.upcomingHours)} still to come
              {hasPay && data.taxDeductionPercent > 0 && ` · about ${formatMoney(data.totalNetPay)} after ${data.taxDeductionPercent}% deductions`}
              {!hasPay && " · add an hourly rate to a job to see pay"}
            </p>
          ) : (
            !hasPay && <p className="mt-2 text-xs text-pretty text-muted-foreground">Add an hourly rate to a job to see pay.</p>
          )}

          {data.byJob.length > 1 && (
            <ul className="mt-4 space-y-3 border-t border-border pt-4">
              {data.byJob.map((job) => (
                <li key={job.jobId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{job.companyName?.trim() || job.jobTitle}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatHours(job.hours)}
                      {job.grossPay > 0 && ` · ${formatMoney(job.grossPay)}`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full" style={{ width: `${(job.hours / mostHours) * 100}%`, backgroundColor: job.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
