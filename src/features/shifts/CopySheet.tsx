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
const MAX_LISTED = 3;

// The same three shortcuts as the phone app's Copy screen
const QUICK_PICKS = [
  { label: "Next Day", days: 1 },
  { label: "Next Week", days: 7 },
  { label: "In 2 Weeks", days: 14 },
];

/** "Copied to 3 days" — and, when some would have overlapped, how many were left out. */
export const announceCopy = ({ created, skipped }: BulkCreateResult) => {
  const made = `${created.length} shift${created.length === 1 ? "" : "s"}`;
  const left = skipped.length ? `${skipped.length} left out — ${skipped.length === 1 ? "it overlaps" : "they overlap"} a shift already there` : undefined;
  if (created.length === 0) notify.info("Nothing was copied", { description: left });
  else notify.success(`Copied ${made}`, { description: left });
};

/**
 * Copy one shift, or several picked on the Shifts page, onto other days: same
 * job, same times of day. With shifts on several days, a picked day is where
 * the first one lands and the rest keep their spacing (the backend's rule).
 */
export function CopySheet({ shiftIds, onClose }: { shiftIds: string[]; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const { data: shifts, error: loadError, retry } = useFetch(
    async () => (await Promise.all(shiftIds.map(getShiftById))).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
    [shiftIds.join(",")],
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const anchor = shifts?.length ? startOfDay(new Date(shifts[0].startTime)) : null;
  // Days after the first shift, never in the past
  const from = anchor ? startOfDay(new Date(Math.max(openedAt, anchor.getTime()))) : null;
  const days = from ? Array.from({ length: DAYS_AHEAD }, (_, index) => addDays(from, index + 1)) : [];
  const toggle = (day: string) => setPicked((current) => (current.includes(day) ? current.filter((other) => other !== day) : [...current, day]));

  const isMultiDay = new Set(shifts?.map((shift) => toDateInput(new Date(shift.startTime)))).size > 1;
  const copyCount = (shifts?.length ?? 0) * picked.length;

  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      announceCopy(await copyShifts({ shiftIds, targetDates: [...picked].sort() }));
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, shiftIds.length === 1 ? "Couldn’t copy this shift." : "Couldn’t copy these shifts."));
      setBusy(false);
    }
  };

  return (
    <Sheet
      ref={sheet}
      title={shiftIds.length === 1 ? "Copy Shift" : `Copy ${shiftIds.length} Shifts`}
      onClose={onClose}
      cancelOnly={!shifts}
      action={
        shifts
          ? {
              label: picked.length === 0 ? "Pick the days" : `Copy to ${picked.length} day${picked.length === 1 ? "" : "s"}${shifts.length > 1 ? ` (${copyCount} shifts)` : ""}`,
              onClick: copy,
              busy,
              disabled: picked.length === 0,
            }
          : undefined
      }
    >
      {loadError ? (
        <LoadError message={loadError} onRetry={retry} />
      ) : !shifts || !anchor ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          <FormError>{error}</FormError>
          <ShiftList>
            {shifts.slice(0, MAX_LISTED).map((shift) => (
              <ShiftRow key={shift.id} shift={shift} />
            ))}
          </ShiftList>
          {shifts.length > MAX_LISTED && <p className="mt-2 text-sm text-muted-foreground">+{shifts.length - MAX_LISTED} more</p>}
          {shifts.length === 1 && <p className="mt-2 text-xs text-muted-foreground">The same job at {formatShiftTimes(shifts[0])} on each day you pick.</p>}

          <SectionLabel className="mt-5 mb-2.5">Copy to</SectionLabel>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {QUICK_PICKS.map((pick) => {
              const value = toDateInput(addDays(anchor, pick.days));
              const isOn = picked.includes(value);
              return (
                <button
                  key={pick.label}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggle(value)}
                  className={`h-10 rounded-lg text-sm font-medium transition-[scale,background-color] duration-100 ease-out active:scale-[0.97] ${isOn ? "bg-primary text-primary-foreground" : "surface pointer-fine:hover:bg-hover"}`}
                >
                  {pick.label}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            {isMultiDay
              ? `Or pick the day your ${anchor.toLocaleDateString("en-US", { weekday: "long" })} shift should land on — the others keep the same spacing.`
              : "Or pick any days below. Times stay the same."}
          </p>
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
