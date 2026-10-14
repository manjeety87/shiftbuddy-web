"use client";

import { CircleCheck } from "lucide-react";
import { ShiftList, ShiftRow } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Shift } from "@/interfaces/shift.d";
import { getConflicts } from "@/lib/conflicts";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { jobName } from "@/lib/jobLabels";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { commuteLabel } from "@/lib/travelConflicts";
import { useFetch } from "@/lib/useFetch";

const MINUTE_MS = 60000;
const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / MINUTE_MS);

/** A fix the person can make: says exactly what to change, and opens that shift to change it. */
function Fix({ title, detail, shift }: { title: string; detail: string; shift: Shift }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-pretty text-muted-foreground">{detail}</span>
      </span>
      <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "shift", shiftId: shift.id })}>
        Edit
      </Button>
    </li>
  );
}

/**
 * One schedule problem: two shifts that overlap, or two too close to travel
 * between. Shows both, what's wrong and concrete ways out. Re-checks whenever a
 * shift changes, and says "All clear" once it's fixed.
 */
export function ConflictSheet({ conflict, fromId, toId, onClose }: { conflict: "overlap" | "travel"; fromId: string; toId: string; onClose: () => void }) {
  const { data, error, retry, refetch } = useFetch(getConflicts);
  useShiftsChanged(refetch);

  const overlap = conflict === "overlap" ? data?.overlaps.find((pair) => pair.first.id === fromId && pair.second.id === toId) : undefined;
  const travel = conflict === "travel" ? data?.travel.find((pair) => pair.fromShift.id === fromId && pair.toShift.id === toId) : undefined;
  const first = overlap?.first ?? travel?.fromShift;
  const second = overlap?.second ?? travel?.toShift;

  return (
    <Sheet title={conflict === "overlap" ? "Overlapping Shifts" : "Tight Connection"} onClose={onClose}>
      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : !data ? (
        <SkeletonRows rows={3} />
      ) : !first || !second ? (
        <div className="flex flex-col items-center surface px-6 py-10 text-center">
          <CircleCheck aria-hidden className="mb-3 size-10 text-success" />
          <p className="text-lg font-semibold">All clear</p>
          <p className="mt-1 text-sm text-muted-foreground">These two shifts no longer clash.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm font-semibold">{formatDate(first.startTime)}</p>
          <ShiftList className="mb-5">
            <ShiftRow shift={first} onClick={() => openSheet({ kind: "shift", shiftId: first.id })} />
            <ShiftRow shift={second} onClick={() => openSheet({ kind: "shift", shiftId: second.id })} />
          </ShiftList>

          {overlap && (
            <>
              <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Both run from {formatTime(second.startTime)} to {formatTime(first.endTime < second.endTime ? first.endTime : second.endTime)} —{" "}
                {formatDuration(minutesBetween(second.startTime, first.endTime < second.endTime ? first.endTime : second.endTime))} in two places at once.
              </p>
              <div className="mt-5">
                <SectionLabel>Ways to fix it</SectionLabel>
                <ul className="divide-y divide-border surface">
                  <Fix title={`End ${jobName(first.job)} by ${formatTime(second.startTime)}`} detail="Then the second shift starts as the first one finishes." shift={first} />
                  <Fix title={`Start ${jobName(second.job)} at ${formatTime(first.endTime)}`} detail="Or later, if you also need time to get there." shift={second} />
                </ul>
              </div>
            </>
          )}

          {travel && (
            <>
              <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${travel.severity === "late" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-foreground"}`}>
                {travel.severity === "late"
                  ? `You’d be about ${travel.lateByMinutes} min late to ${jobName(second.job)}.`
                  : `You’d arrive at ${jobName(second.job)} with only ${travel.slackMinutes} min to spare.`}{" "}
                {travel.travelMinutes} min by {commuteLabel(travel.mode)}: leave {formatTime(first.endTime)}, arrive {formatTime(travel.earliestStart)}. The gap is {formatDuration(travel.gapMinutes)}.
              </p>
              <div className="mt-5">
                <SectionLabel>Ways to fix it</SectionLabel>
                <ul className="divide-y divide-border surface">
                  {travel.leaveBy && (
                    <Fix
                      title={`Leave ${jobName(first.job)} by ${formatTime(travel.leaveBy)}`}
                      detail={`${formatDuration(minutesBetween(travel.leaveBy, first.endTime))} before it ends — then you’re on time.`}
                      shift={first}
                    />
                  )}
                  <Fix title={`Start ${jobName(second.job)} at ${formatTime(travel.earliestStart)}`} detail="When you’d actually get there if you leave as the first shift ends." shift={second} />
                </ul>
              </div>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => openSheet({ kind: "route", shiftId: second.id })}>
                See the trip to {jobName(second.job)}
              </Button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
