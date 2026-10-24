"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatShiftTimes } from "@/components/ShiftRow";
import { Button } from "@/components/ui/Button";
import { FormError, SectionLabel, TextArea } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { MissedReason, Shift } from "@/interfaces/shift.d";
import { errorMessage } from "@/lib/api";
import { jobName } from "@/lib/jobLabels";
import { clearShiftMissed, markShiftMissed, MISSED_REASONS } from "@/lib/missedShifts";
import { notify } from "@/lib/notify";
import { getShiftById } from "@/lib/shifts";

const MAX_NOTE = 500;

/**
 * "Couldn't go" for one shift: sick, called off, an emergency… It stays on the
 * schedule as a record; the backend stops counting it for pay, leave-by and clashes.
 * Opened from Home's card (before or after the shift starts) and from Edit Shift.
 */
export function MissedShiftSheet({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [reason, setReason] = useState<MissedReason | null>(null);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "undo" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getShiftById(shiftId)
      .then((loaded) => {
        setShift(loaded);
        setReason(loaded.missedReason);
        setNote(loaded.missedNote ?? "");
        setLoadError(null);
      })
      .catch((failure) => setLoadError(errorMessage(failure, "Couldn’t open this shift.")));
  }, [shiftId, attempt]);

  const wasMissed = !!shift?.missedReason;
  const isDirty = !!shift && (reason !== shift.missedReason || note.trim() !== (shift.missedNote ?? ""));

  const save = async () => {
    if (!reason) return setError("Choose what happened.");
    setError(null);
    setBusy("save");
    try {
      await markShiftMissed(shiftId, { reason, note: note.trim() });
      sheet.current?.dismiss();
      if (wasMissed) {
        notify.success("Saved");
      } else {
        // A mis-click on Home costs one click to fix
        notify.success("Marked as missed", {
          action: { label: "Undo", onPress: () => void clearShiftMissed(shiftId).catch(() => notify.error("Couldn’t undo — open the shift to try again")) },
        });
      }
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save."));
      setBusy(null);
    }
  };

  const undo = async () => {
    setBusy("undo");
    try {
      await clearShiftMissed(shiftId);
      sheet.current?.dismiss();
      notify.success("Back on your schedule");
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save."));
      setBusy(null);
    }
  };

  return (
    <Sheet
      ref={sheet}
      title="Missed Shift"
      onClose={onClose}
      isDirty={isDirty}
      action={shift ? { label: "Save", onClick: save, busy: busy === "save", disabled: !reason || busy === "undo" } : undefined}
      cancelOnly={!shift}
      footerStart={
        wasMissed && (
          <Button variant="secondary" busy={busy === "undo"} disabled={busy === "save"} onClick={undo}>
            {shift?.missedReason === "CALLED_OFF" ? "It’s Back On" : "I Went After All"}
          </Button>
        )
      }
    >
      {loadError ? (
        <LoadError message={loadError} onRetry={() => setAttempt((count) => count + 1)} />
      ) : !shift ? (
        <SkeletonRows rows={3} className="h-12" />
      ) : (
        <>
          <div className="surface mb-5 flex items-center gap-3 px-3.5 py-3">
            <span aria-hidden className="w-1 self-stretch rounded-full" style={{ backgroundColor: shift.job.color }} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{jobName(shift.job)}</span>
              <span className="block text-sm text-muted-foreground tabular-nums">
                {new Date(shift.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatShiftTimes(shift)}
              </span>
            </span>
          </div>

          <FormError>{error}</FormError>
          <SectionLabel id="missed-reason">What happened?</SectionLabel>
          <div role="radiogroup" aria-labelledby="missed-reason" className="surface mb-5 divide-y divide-border overflow-hidden">
            {MISSED_REASONS.map((option) => {
              const isOn = reason === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  onClick={() => setReason(option.value)}
                  className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left row-hover"
                >
                  <span className={`flex-1 text-sm ${isOn ? "font-semibold" : ""}`}>{option.label}</span>
                  {isOn && <Check aria-hidden className="size-4 text-primary" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>

          <TextArea
            label="Note"
            placeholder="Optional — e.g. told Sam at 8 AM"
            maxLength={MAX_NOTE}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            hint="It stays on your schedule, but won’t count toward pay, leave-by times or clashes."
          />
        </>
      )}
    </Sheet>
  );
}
