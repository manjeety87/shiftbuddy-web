"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Shift } from "@/interfaces/shift.d";
import { formatTime } from "@/lib/dateUtils";
import { jobName, jobRole } from "@/lib/jobLabels";
import { missedTag } from "@/lib/missedShifts";
import { formatDuration } from "@/lib/shiftTime";

const MINUTE_MS = 60000;

type RowShift = Pick<Shift, "startTime" | "endTime"> & Partial<Pick<Shift, "missedReason">> & { job: Pick<Shift["job"], "title" | "companyName" | "color"> };

/** "9:00 AM – 5:00 PM", with "+1" when it ends on another day. */
export const formatShiftTimes = (shift: Pick<Shift, "startTime" | "endTime">) => {
  const overnight = new Date(shift.startTime).toDateString() !== new Date(shift.endTime).toDateString();
  return `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}${overnight ? " +1" : ""}`;
};

/** "9a", "5:30p" — the short clock a calendar cell or a week column has room for. */
export const shortTime = (iso: string) => {
  const date = new Date(iso);
  const hour = date.getHours() % 12 || 12;
  const minutes = date.getMinutes();
  return `${hour}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${date.getHours() < 12 ? "a" : "p"}`;
};

export const shiftMinutes = (shift: Pick<Shift, "startTime" | "endTime">) => Math.round((Date.parse(shift.endTime) - Date.parse(shift.startTime)) / MINUTE_MS);

/** Total length of the shifts that will be (or were) worked — missed ones stay listed but add nothing */
export const countedMinutes = (shifts: Pick<Shift, "startTime" | "endTime" | "missedReason">[]) => shifts.reduce((total, shift) => total + (shift.missedReason ? 0 : shiftMinutes(shift)), 0);

export const isHappeningNow = (shift: Pick<Shift, "startTime" | "endTime">, now: number) => Date.parse(shift.startTime) <= now && Date.parse(shift.endTime) > now;

export function NowBadge() {
  return <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-2xs font-semibold text-primary">Now</span>;
}

/** "Missed · Sick", "Called off" — in place of Now on a shift the user isn't going to */
export function MissedBadge({ reason }: { reason: NonNullable<Shift["missedReason"]> }) {
  return <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-2xs font-semibold text-muted-foreground">{missedTag(reason)}</span>;
}

/** Rows that belong together share one surface and are separated by hairlines. */
export function ShiftList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface divide-y divide-border overflow-hidden ${className}`}>{children}</div>;
}

/**
 * A shift as a row inside a `ShiftList`: the workplace is the name, the role is
 * the detail (someone can hold the same role at two stores).
 */
export function ShiftRow({ shift, onClick, isNow = false, footer, trailing }: { shift: RowShift; onClick?: () => void; isNow?: boolean; footer?: ReactNode; trailing?: ReactNode }) {
  const role = jobRole(shift.job);
  const missed = shift.missedReason;
  const body = (
    <>
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: shift.job.color }} />
      <span className={`min-w-0 flex-1 ${missed ? "opacity-65" : ""}`}>
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-medium md:text-sm">{jobName(shift.job)}</span>
          {missed ? <MissedBadge reason={missed} /> : isNow && <NowBadge />}
        </span>
        <span className={`block truncate text-sm text-muted-foreground tabular-nums md:text-xs ${missed ? "line-through" : ""}`}>
          {formatShiftTimes(shift)}
          {role && ` · ${role}`}
        </span>
      </span>
      {trailing ?? <span className={`shrink-0 text-sm text-muted-foreground tabular-nums ${missed ? "line-through opacity-65" : ""}`}>{formatDuration(shiftMinutes(shift))}</span>}
      {onClick && <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />}
    </>
  );
  const shape = "flex w-full items-center gap-3 px-3.5 py-3 text-left md:py-2.5";

  return (
    <div>
      {onClick ? (
        <button type="button" onClick={onClick} className={`${shape} row-hover`}>
          {body}
        </button>
      ) : (
        <div className={shape}>{body}</div>
      )}
      {footer}
    </div>
  );
}
