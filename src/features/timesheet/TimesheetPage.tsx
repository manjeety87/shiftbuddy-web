"use client";

import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { selectClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { formatTime } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/inputs";
import { jobName } from "@/lib/jobLabels";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { formatCalendarDay, getTimesheet, getWeekTimesheet, useTimesheetChanged, type TimesheetEntry, type WeekTimesheet } from "@/lib/timesheet";
import { useFetch } from "@/lib/useFetch";
import { useMyJobs } from "@/lib/useMyJobs";
import { jobOptionLabel } from "../jobs/JobSelect";

const ALL_JOBS = "all";

type Row = TimesheetEntry & { job?: WeekTimesheet["entries"][number]["job"] };

// The header and every row share these columns. A phone keeps the day, the times under it, and the paid total.
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-4 px-4 md:grid-cols-[8rem_minmax(0,1fr)_6rem_6rem_5rem_5rem_1rem]";

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="surface min-w-0 px-3 py-3 sm:px-4 sm:py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-xl font-semibold tabular-nums sm:text-2xl">{children}</dd>
    </div>
  );
}

/** Hours actually worked: every job by calendar week, or one job by its pay period. */
export function TimesheetPage() {
  const { data: jobs } = useMyJobs();
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [offset, setOffset] = useState(0);

  const sheet = useFetch(async () => (jobId === ALL_JOBS ? { week: await getWeekTimesheet(offset), job: null } : { week: null, job: await getTimesheet(jobId, offset) }), [jobId, offset]);
  useTimesheetChanged(sheet.refetch);

  const data = sheet.data;
  const period = data?.week?.period ?? data?.job?.period;
  const totals = data?.week?.totals ?? data?.job?.totals;
  const entries: Row[] = data?.week?.entries ?? data?.job?.entries ?? [];
  const payday = data?.job?.period.payday;
  const missingRates = data?.week?.totals.missingRates ?? false;

  const periodLabel = period ? `${formatCalendarDay(period.start)} – ${formatCalendarDay(period.end)}` : " ";
  const hasNoJobs = jobs?.length === 0;
  // The side column only earns its place when there is a split to show
  const hasJobSplit = (data?.week?.byJob.length ?? 0) > 0;
  const addHours = () => openSheet({ kind: "timeEntry", jobId: jobId === ALL_JOBS ? undefined : jobId });

  return (
    <>
      <PageHeader
        title="Timesheet"
        description="The hours you actually worked, for checking against your pay."
        actions={
          hasNoJobs ? undefined : (
            <Button aria-label="Add hours" icon={<Plus aria-hidden className="size-4" />} onClick={addHours}>
              <span className="hidden sm:inline">Add Hours</span>
            </Button>
          )
        }
      />

      {hasNoJobs ? (
        <EmptyState icon={ClipboardList} title="Add a job first" action={<Button onClick={() => openSheet({ kind: "job" })}>Add Job</Button>}>
          Hours are kept per job, so a timesheet starts with one.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <select
              aria-label="Show"
              value={jobId}
              onChange={(event) => {
                setJobId(event.target.value);
                setOffset(0);
              }}
              className={`${selectClass} w-full! max-w-full sm:w-auto! sm:min-w-56`}
            >
              <option value={ALL_JOBS}>All jobs — by week</option>
              {jobs?.map((job) => (
                <option key={job.id} value={job.id}>
                  {jobOptionLabel(job)} — by pay period
                </option>
              ))}
            </select>
            <PeriodNav
              className="min-w-0 flex-1 basis-72"
              label={periodLabel}
              context={offset === 0 ? (jobId === ALL_JOBS ? "This week" : "This pay period") : undefined}
              onPrevious={() => setOffset((value) => value - 1)}
              onNext={() => setOffset((value) => value + 1)}
              nextDisabled={offset >= 0}
              onToday={offset === 0 ? undefined : () => setOffset(0)}
            />
          </div>

          {sheet.error ? (
            <LoadError message={sheet.error} onRetry={sheet.retry} />
          ) : !data || !totals ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className={`grid items-start gap-8 ${hasJobSplit ? "lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}`}>
              <div className="min-w-0">
                <section aria-label="Totals" className="mb-5">
                  <dl className="grid grid-cols-3 gap-3">
                    <Stat label="Paid hours">{formatDuration(totals.paidMinutes)}</Stat>
                    <Stat
                      label={
                        <>
                          <span className="sm:hidden">Breaks</span>
                          <span className="max-sm:hidden">Unpaid breaks</span>
                        </>
                      }
                    >{formatDuration(totals.breakMinutes)}</Stat>
                    <Stat label="Gross pay">{totals.grossPay != null ? formatMoney(totals.grossPay) : "—"}</Stat>
                  </dl>
                  {(data.job || missingRates) && (
                    <p className="mt-2.5 text-xs text-pretty text-muted-foreground">
                      {data.job &&
                        (payday ? (
                          `Paid on ${formatCalendarDay(payday, { weekday: "short", month: "short", day: "numeric" })}.`
                        ) : (
                          <>
                            These dates are a guess.{" "}
                            <button type="button" className="font-medium text-primary pointer-fine:hover:underline" onClick={() => openSheet({ kind: "job", jobId })}>
                              Add a payday to this job
                            </button>{" "}
                            to match your pay stub.
                          </>
                        ))}
                      {data.job && totals.grossPay == null && " Add an hourly rate to the job to see pay."}
                      {missingRates && "Some hours are for jobs without an hourly rate, so they aren’t in the pay figure."}
                    </p>
                  )}
                </section>

                {entries.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-5">
                    <p className="flex-1 text-sm text-pretty text-muted-foreground">No hours in this period. Clock in from Home when a shift starts, or add hours you already worked.</p>
                    <Button variant="secondary" size="sm" icon={<Plus aria-hidden className="size-3.5" />} onClick={addHours}>
                      Add Hours
                    </Button>
                  </div>
                ) : (
                  <div className="surface overflow-hidden">
                    <div aria-hidden className={`${COLUMNS} hidden h-9 border-b border-border text-xs font-medium text-muted-foreground md:grid`}>
                      <span>Day</span>
                      <span>Job</span>
                      <span>In</span>
                      <span>Out</span>
                      <span>Break</span>
                      <span className="text-right">Paid</span>
                      <span />
                    </div>
                    <ul className="divide-y divide-border">
                      {entries.map((entry) => {
                        const day = new Date(entry.clockIn).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        const out = entry.clockOut ? formatTime(entry.clockOut) : "Still in";
                        return (
                          <li key={entry.id}>
                            <button type="button" onClick={() => openSheet({ kind: "timeEntry", entryId: entry.id })} className={`${COLUMNS} w-full py-3 text-left row-hover md:py-2.5`}>
                              <span className="min-w-0 md:contents">
                                <span className="block truncate text-base font-medium md:text-sm">
                                  {day}
                                  {entry.job && <span className="font-normal text-muted-foreground md:hidden"> · {jobName(entry.job)}</span>}
                                </span>
                                <span className="block text-sm text-muted-foreground tabular-nums md:hidden">
                                  {formatTime(entry.clockIn)} – {entry.clockOut ? out : "still clocked in"}
                                  {entry.breakMinutes > 0 && ` · ${entry.breakMinutes} min break`}
                                </span>
                              </span>
                              <span className="hidden min-w-0 items-center gap-2 text-sm md:flex">
                                {entry.job ? (
                                  <>
                                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.job.color }} />
                                    <span className="truncate">{jobName(entry.job)}</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </span>
                              <span className="hidden text-sm tabular-nums md:block">{formatTime(entry.clockIn)}</span>
                              <span className={`hidden text-sm tabular-nums md:block ${entry.clockOut ? "" : "font-medium text-warning-ink"}`}>{out}</span>
                              <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{entry.breakMinutes > 0 ? `${entry.breakMinutes} min` : "—"}</span>
                              <span className={`text-right text-sm font-semibold tabular-nums ${entry.paidMinutes == null ? "text-warning-ink" : ""}`}>{entry.paidMinutes == null ? "Running" : formatDuration(entry.paidMinutes)}</span>
                              <ChevronRight aria-hidden className="size-4 text-faint" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {data.week && hasJobSplit && (
                <section aria-label="By job">
                  <h2 className="mb-2.5 text-sm font-semibold">By job</h2>
                  <ul className="surface divide-y divide-border overflow-hidden">
                    {data.week.byJob.map((line) => (
                      <li key={line.job.id}>
                        <button
                          type="button"
                          title="See this job’s pay period"
                          onClick={() => {
                            setJobId(line.job.id);
                            setOffset(0);
                          }}
                          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm row-hover"
                        >
                          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: line.job.color }} />
                          <span className="min-w-0 flex-1 truncate font-medium">{jobName(line.job)}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatDuration(line.paidMinutes)}
                            {line.grossPay != null && ` · ${formatMoney(line.grossPay)}`}
                          </span>
                          <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">Open a job to see its pay period.</p>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
