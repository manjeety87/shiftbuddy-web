"use client";

import { useState } from "react";
import { PeriodNav } from "@/components/PeriodNav";
import { ShiftList, ShiftRow } from "@/components/ShiftRow";
import { Sheet } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { getWeekDays, isSameDay } from "@/lib/dateUtils";
import { addDays, formatDayLabel } from "@/lib/inputs";
import { getSharedShifts } from "@/lib/shares";
import { useFetch } from "@/lib/useFetch";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Someone else's week, read-only: times and workplace only — the backend sends nothing more. */
export function SharedSheet({ ownerId, ownerName, date, onClose }: { ownerId: string; ownerName: string; date?: Date; onClose: () => void }) {
  // Opened from a shift on the calendar: start on that shift's week, not on today's
  const [offset, setOffset] = useState(() => (date ? Math.round((getWeekDays(date)[0].getTime() - getWeekDays(new Date())[0].getTime()) / WEEK_MS) : 0));
  const days = getWeekDays(addDays(new Date(), offset * 7));
  const from = days[0];
  const to = addDays(from, 7);
  const { data, error, retry } = useFetch(() => getSharedShifts(ownerId, from.toISOString(), to.toISOString()), [ownerId, offset]);

  const label = `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const workingDays = days.filter((day) => data?.shifts.some((shift) => isSameDay(new Date(shift.startTime), day)));

  return (
    <Sheet title={`${ownerName}’s Week`} onClose={onClose}>
      <PeriodNav label={label} context={offset === 0 ? "This week" : undefined} onPrevious={() => setOffset((week) => week - 1)} onNext={() => setOffset((week) => week + 1)} onToday={offset === 0 ? undefined : () => setOffset(0)} />
      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : !data ? (
        <SkeletonRows rows={3} />
      ) : workingDays.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">{ownerName} has no shifts this week.</p>
      ) : (
        <div className="space-y-4">
          {workingDays.map((day) => (
            <section key={day.toISOString()}>
              <h3 className="mb-1.5 text-sm font-semibold">{formatDayLabel(day)}</h3>
              <ShiftList>
                {data.shifts
                  .filter((shift) => isSameDay(new Date(shift.startTime), day))
                  .map((shift) => (
                    <ShiftRow key={shift.id} shift={shift} />
                  ))}
              </ShiftList>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
