"use client";

import { ImageUp } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/notify";
import { extractShiftsFromImage } from "@/lib/ocr";
import { useUser } from "@/lib/session";
import { openSheet } from "@/lib/sheets";
import { createShiftsBulk } from "@/lib/shifts";
import { formatDuration, resolveShiftRange, toShiftTimes } from "@/lib/shiftTime";
import { useMyJobs } from "@/lib/useMyJobs";
import { ReviewTable, type Draft } from "./ReviewTable";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Photo of a schedule → the shifts in it → check them → save. Nothing is saved
 * until the last step, and every row can be corrected or removed first.
 */
export function ScanSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const picker = useRef<HTMLInputElement>(null);
  const user = useUser();
  const { data: jobs } = useMyJobs();
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo or screenshot (JPG or PNG).");
    if (file.size > MAX_IMAGE_BYTES) return setError("That image is over 8 MB. Try a screenshot or a smaller photo.");
    setError(null);
    setImage(file);
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  const read = async () => {
    if (!image) return;
    setBusy("read");
    setError(null);
    try {
      const found = await extractShiftsFromImage(image, name.trim());
      if (found.length === 0) setError(`No shifts for “${name.trim()}” in that image. Check the name matches the schedule, or try a clearer photo.`);
      else setDrafts(found.map((shift, key) => ({ key, jobId: shift.suggestedJobId ?? (jobs?.length === 1 ? jobs[0].id : null), times: toShiftTimes(shift.startTime, shift.endTime), notes: shift.notes, needsReview: shift.needsReview })));
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t read that image. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const change = (key: number, patch: Partial<Draft>) => setDrafts((rows) => rows?.map((row) => (row.key === key ? { ...row, ...patch, needsReview: false } : row)) ?? null);
  const missingJob = drafts?.some((draft) => !draft.jobId) ?? false;

  const save = async () => {
    if (!drafts) return;
    setBusy("save");
    setError(null);
    try {
      const { created, skipped } = await createShiftsBulk(
        drafts.map((draft) => {
          const range = resolveShiftRange(draft.times);
          return { jobId: draft.jobId as string, startTime: range.startAt.toISOString(), endTime: range.endAt.toISOString(), notes: draft.notes };
        }),
      );
      const left = skipped.length ? `${skipped.length} left out — already on your schedule at that time` : undefined;
      if (created.length) notify.success(`Added ${created.length} shift${created.length === 1 ? "" : "s"}`, { description: left });
      else notify.info("Nothing new to add", { description: left });
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save these shifts."));
      setBusy(null);
    }
  };

  return (
    <Sheet
      ref={sheet}
      title={drafts ? "Check the Shifts" : "Scan a Schedule"}
      onClose={onClose}
      isDirty={!!drafts}
      wide={!!drafts}
      action={
        drafts
          ? { label: drafts.length === 0 ? "No shifts left" : missingJob ? "Choose a job for every shift" : `Add ${drafts.length} Shift${drafts.length === 1 ? "" : "s"}`, onClick: save, busy: busy === "save", disabled: drafts.length === 0 || missingJob }
          : { label: busy === "read" ? "Reading the schedule…" : "Read Shifts", onClick: read, busy: busy === "read", disabled: !image || name.trim().length < 2 }
      }
    >
      <FormError>{error}</FormError>

      {!drafts ? (
        <>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`mb-4 flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-[background-color,border-color] duration-150 ${
              dragging ? "border-primary bg-primary/10" : "border-border-strong bg-card pointer-fine:hover:border-faint"
            }`}
          >
            <ImageUp aria-hidden className="mb-3 size-8 text-primary" />
            <span className="text-sm font-medium">{image ? image.name : "Choose a photo of your schedule"}</span>
            <span className="mt-1 text-xs text-muted-foreground">{image ? "Click to choose a different one" : "or drop it here — a screenshot works too"}</span>
          </button>
          <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />

          <TextField label="Your name on the schedule" value={name} onChange={(event) => setName(event.target.value)} hint="Only this person’s shifts are read from the image." />

          {busy === "read" && (
            // The button already shows the spinner; this line only says how long to expect
            <p className="mt-3 text-xs text-muted-foreground">This can take up to a minute.</p>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-pretty text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {drafts.length} shift{drafts.length === 1 ? "" : "s"} · {formatDuration(drafts.reduce((total, draft) => total + resolveShiftRange(draft.times).durationMinutes, 0))}
            </span>{" "}
            read from the photo. Click anything that’s wrong to change it, then add them. Shifts already on your schedule are left out.
          </p>

          {jobs?.length === 0 && (
            <div className="mb-4 flex items-center gap-3 surface px-4 py-3.5">
              <p className="flex-1 text-sm text-muted-foreground">Add the job these shifts are for. Your scan stays here.</p>
              <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "job" })}>
                Add Job
              </Button>
            </div>
          )}

          <ReviewTable drafts={drafts} jobs={jobs} onChange={change} onRemove={(key) => setDrafts((rows) => rows?.filter((row) => row.key !== key) ?? null)} />
        </>
      )}
    </Sheet>
  );
}
