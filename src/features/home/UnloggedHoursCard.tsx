"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useFeatureToggle } from "@/components/FeatureSwitches";
import { formatShiftTimes } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api";
import { formatDayLabel } from "@/lib/inputs";
import { jobName } from "@/lib/jobLabels";
import { notify } from "@/lib/notify";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { createTimeEntry, deleteTimeEntry, type UnloggedShift } from "@/lib/timesheet";

/**
 * "Add your hours?" — shifts that ended without a clock-in or clock-out. Add saves
 * the scheduled hours with the usual break; clicking a row opens them to change
 * first; "Didn't go" marks it missed. Every finished shift ends up worked or missed.
 */
export function UnloggedHoursCard({ items, now }: { items: UnloggedShift[]; now: number }) {
  const { toggle } = useFeatureToggle();
  const [adding, setAdding] = useState<string | null>(null);

  const add = async ({ shift, suggested }: UnloggedShift) => {
    setAdding(shift.id);
    try {
      const entry = await createTimeEntry({ shiftId: shift.id, clockIn: suggested.clockIn, clockOut: suggested.clockOut, breakMinutes: suggested.breakMinutes });
      notify.success(`Added ${formatDuration(suggested.paidMinutes)} at ${jobName(shift.job)}`, {
        action: { label: "Undo", onPress: () => void deleteTimeEntry(entry.id).catch(() => notify.error("Couldn’t undo — open your timesheet to fix it")) },
      });
    } catch (failure) {
      notify.error("Couldn’t add the hours", { description: errorMessage(failure) });
    } finally {
      setAdding(null);
    }
  };

  const alwaysAdd = async () => {
    await toggle("autoHours", true);
    notify.success("Your hours will be added after each shift", { description: "Change it any time in Settings › Features." });
  };

  return (
    <section aria-labelledby="unlogged-title" className="surface mb-7 overflow-hidden transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0">
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <ClipboardCheck aria-hidden className="size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 id="unlogged-title" className="text-sm font-semibold">
            {items.length === 1 ? "Add your hours?" : `Add hours for ${items.length} shifts?`}
          </h2>
          <p className="text-xs text-muted-foreground">You didn’t clock in. These are your scheduled times.</p>
        </div>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((item) => {
          const { shift, suggested } = item;
          return (
            <li key={shift.id} className="flex items-center gap-3 px-4 py-2.5">
              <span aria-hidden className="w-1 self-stretch rounded-full" style={{ backgroundColor: shift.job.color }} />
              <button type="button" onClick={() => openSheet({ kind: "timeEntry", shiftId: shift.id })} className="min-w-0 flex-1 rounded-md text-left" title="Change the hours first">
                <span className="block truncate text-sm font-medium">{jobName(shift.job)}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {formatDayLabel(new Date(shift.startTime), new Date(now))} · {formatShiftTimes(shift)} · {formatDuration(suggested.paidMinutes)}
                </span>
              </button>
              <Button variant="quiet" size="sm" onClick={() => openSheet({ kind: "missed", shiftId: shift.id })}>
                Didn’t go
              </Button>
              <Button size="sm" busy={adding === shift.id} disabled={adding !== null} aria-label={`Add ${formatDuration(suggested.paidMinutes)} at ${jobName(shift.job)}`} onClick={() => add(item)}>
                Add
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="px-2 py-1.5">
        <Button variant="quiet" size="sm" onClick={alwaysAdd}>
          Always add my hours for me
        </Button>
      </div>
    </section>
  );
}
