"use client";

import { useRef, useState } from "react";
import { formatShiftTimes, ShiftList, ShiftRow } from "@/components/ShiftRow";
import { FormError, SectionLabel } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { errorMessage } from "@/lib/api";
import { addDays, startOfDay, toDateInput } from "@/lib/inputs";
import { notify } from "@/lib/notify";
import { copyShifts, getShiftById, type BulkCreateResult } from "@/lib/shifts";
import { useFetch } from "@/lib/useFetch";

const DAYS_AHEAD = 28;

/** "Copied to 3 days" — and, when some would have overlapped, how many were left out. */
export const announceCopy = ({ created, skipped }: BulkCreateResult) => {
  const made = `${created.length} shift${created.length === 1 ? "" : "s"}`;
  const left = skipped.length ? `${skipped.length} left out — ${skipped.length === 1 ? "it overlaps" : "they overlap"} a shift already there` : undefined;
  if (created.length === 0) notify.info("Nothing was copied", { description: left });
  else notify.success(`Copied ${made}`, { description: left });
};

/** Copy one shift onto other days: same job, same times of day. Pick as many days as needed. */
export function CopySheet({ shiftIds, onClose }: { shiftIds: string[]; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const { data: shift, error: loadError, retry } = useFetch(() => getShiftById(shiftIds[0]), [shiftIds[0]]);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  // Days after the shift itself, never in the past
  const from = shift ? startOfDay(new Date(Math.max(openedAt, Date.parse(shift.startTime)))) : null;
  const days = from ? Array.from({ length: DAYS_AHEAD }, (_, index) => addDays(from, index + 1)) : [];
  const toggle = (day: string) => setPicked((current) => (current.includes(day) ? current.filter((other) => other !== day) : [...current, day]));

  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      announceCopy(await copyShifts({ shiftIds, targetDates: [...picked].sort() }));
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t copy this shift."));
      setBusy(false);
    }
  };

  return (
    <Sheet
      ref={sheet}
      title="Copy Shift"
      onClose={onClose}
      cancelOnly={!shift}
      action={shift ? { label: picked.length === 0 ? "Pick the days" : `Copy to ${picked.length} day${picked.length === 1 ? "" : "s"}`, onClick: copy, busy, disabled: picked.length === 0 } : undefined}
    >
      {loadError ? (
        <LoadError message={loadError} onRetry={retry} />
      ) : !shift ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          <FormError>{error}</FormError>
          <ShiftList>
            <ShiftRow shift={shift} />
          </ShiftList>
          <p className="mt-2 mb-5 text-xs text-muted-foreground">The same job at {formatShiftTimes(shift)} on each day you pick.</p>

          <SectionLabel>Copy to</SectionLabel>
          <div className="surface grid grid-cols-7 gap-1 p-2">
            {days.map((day) => {
              const value = toDateInput(day);
              const isOn = picked.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isOn}
                  aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  onClick={() => toggle(value)}
                  className={`flex h-13 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-[scale,background-color] duration-100 ease-out active:scale-95 ${
                    isOn ? "bg-primary font-semibold text-primary-foreground" : "pointer-fine:hover:bg-hover"
                  }`}
                >
                  <span className={`text-2xs ${isOn ? "" : "text-muted-foreground"}`}>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Sheet>
  );
}
