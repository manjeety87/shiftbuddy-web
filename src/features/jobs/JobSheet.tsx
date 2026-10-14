"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LocationField } from "@/components/LocationField";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { fromDateInput, toDateInput } from "@/lib/inputs";
import { FormError, SectionLabel, TextField } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Job, PayFrequency } from "@/interfaces/job.d";
import type { Place } from "@/interfaces/user.d";
import { errorMessage } from "@/lib/api";
import { showAlert } from "@/lib/dialog";
import { createJob, deleteJob, getJobById, updateJob } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { useUser } from "@/lib/session";

// Muted on purpose, so a busy week stays calm — the mobile app's job colours
export const JOB_COLOURS = ["#6B8F71", "#B85C4E", "#C99A3A", "#5B8A9A", "#9B7EBD", "#C77B8E", "#7A9E7E"];

const PAY_FREQUENCIES = [
  { value: "WEEKLY", label: "Every week" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
] as const;

interface JobValues {
  companyName: string;
  title: string;
  hourlyRate: string;
  color: string;
  payFrequency: PayFrequency;
  payday: string;
  place: Place | null;
  matchKeywords: string;
}

const EMPTY: JobValues = { companyName: "", title: "", hourlyRate: "", color: JOB_COLOURS[0], payFrequency: "BIWEEKLY", payday: "", place: null, matchKeywords: "" };

const valuesOf = (job: Job): JobValues => ({
  companyName: job.companyName,
  title: job.title,
  hourlyRate: job.hourlyRate == null ? "" : String(job.hourlyRate),
  color: job.color,
  payFrequency: job.payFrequency,
  payday: job.payday ?? "",
  place: job.location && job.latitude != null && job.longitude != null ? { address: job.location, latitude: job.latitude, longitude: job.longitude } : null,
  matchKeywords: job.matchKeywords ?? "",
});

/** Add a job, or change / delete one. A job is known by its workplace; the role is the detail. */
export function JobSheet({ jobId, onClose }: { jobId?: string; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const user = useUser();
  const [values, setValues] = useState<JobValues>(EMPTY);
  const [baseline, setBaseline] = useState<string | null>(jobId ? null : JSON.stringify(EMPTY));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    getJobById(jobId)
      .then((job) => {
        const loaded = valuesOf(job);
        setValues(loaded);
        setBaseline(JSON.stringify(loaded));
        setLoadError(null);
      })
      .catch((failure) => setLoadError(errorMessage(failure, "Couldn’t open this job.")));
  }, [jobId, attempt]);

  const set = <K extends keyof JobValues>(key: K) => (value: JobValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const rate = values.hourlyRate.trim() === "" ? null : Number(values.hourlyRate);
  const rateError = rate != null && !(rate > 0) ? "Enter an amount above 0, or leave it empty" : null;
  const canSave = values.companyName.trim().length >= 1 && values.title.trim().length >= 2 && !rateError;

  const save = async () => {
    setBusy("save");
    setError(null);
    const { place } = values;
    // On an edit, null clears a field the person emptied; a new job just leaves it out
    const optional = <T,>(value: T | null) => (jobId ? value : (value ?? undefined));
    const input = {
      companyName: values.companyName.trim(),
      title: values.title.trim(),
      color: values.color,
      payFrequency: values.payFrequency,
      hourlyRate: optional(rate),
      payday: optional(values.payday || null),
      matchKeywords: optional(values.matchKeywords.trim() || null),
      location: optional(place?.address ?? null),
      latitude: optional(place?.latitude ?? null),
      longitude: optional(place?.longitude ?? null),
    };
    try {
      if (jobId) await updateJob(jobId, input);
      else await createJob(input as Parameters<typeof createJob>[0]);
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save this job."));
      setBusy(null);
    }
  };

  const remove = () => {
    if (!jobId) return;
    showAlert("Delete this job?", "It disappears from your job list and its upcoming shifts are removed. Shifts you already worked there stay in your history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await deleteJob(jobId);
            notify.success("Job deleted");
            sheet.current?.dismiss();
          } catch (failure) {
            setError(errorMessage(failure, "Couldn’t delete this job."));
            setBusy(null);
          }
        },
      },
    ]);
  };

  const isLoaded = baseline !== null;

  return (
    <Sheet
      ref={sheet}
      title={jobId ? "Edit Job" : "New Job"}
      onClose={onClose}
      isDirty={isLoaded && JSON.stringify(values) !== baseline}
      action={isLoaded ? { label: jobId ? "Save" : "Add", onClick: save, busy: busy === "save", disabled: !canSave || busy === "delete" } : undefined}
      cancelOnly={!isLoaded}
      footerStart={
        jobId &&
        isLoaded && (
          <Button variant="danger" icon={<Trash2 aria-hidden className="size-3.5" />} busy={busy === "delete"} disabled={busy === "save"} onClick={remove}>
            Delete Job
          </Button>
        )
      }
    >
      {loadError ? (
        <LoadError message={loadError} onRetry={() => setAttempt((count) => count + 1)} />
      ) : !isLoaded ? (
        <SkeletonRows rows={4} className="h-14" />
      ) : (
        <>
          <FormError>{error}</FormError>
          <div className="grid gap-x-3 sm:grid-cols-2">
          <TextField label="Workplace" placeholder="e.g. Boathouse" autoFocus={!jobId} maxLength={100} value={values.companyName} onChange={(event) => set("companyName")(event.target.value)} />
          <TextField label="Your role" placeholder="e.g. Sales Associate" maxLength={100} value={values.title} onChange={(event) => set("title")(event.target.value)} />
          </div>

          <SectionLabel className="mb-2">Colour</SectionLabel>
          <div role="radiogroup" aria-label="Job colour" className="mb-5 flex flex-wrap gap-2">
            {JOB_COLOURS.map((colour, index) => {
              const isOn = colour.toLowerCase() === values.color.toLowerCase();
              return (
                <button
                  key={colour}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  aria-label={`Colour ${index + 1}`}
                  onClick={() => set("color")(colour)}
                  className={`flex size-9 items-center justify-center rounded-full transition-[scale,box-shadow] duration-150 ease-out active:scale-90 md:size-7 ${isOn ? "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]" : ""}`}
                  style={{ backgroundColor: colour }}
                >
                  {isOn && <Check aria-hidden className="size-4 text-white md:size-3.5" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          <TextField
            label="Hourly rate"
            inputMode="decimal"
            placeholder="Optional — for pay estimates"
            value={values.hourlyRate}
            onChange={(event) => set("hourlyRate")(event.target.value.replace(/[^0-9.]/g, ""))}
            error={rateError}
            hint={user.taxDeductionPercent > 0 ? `Estimates take off ${user.taxDeductionPercent}% for deductions (Settings).` : undefined}
          />

          <div className="grid gap-x-3 sm:grid-cols-2">
            <div className="mb-4">
              <SectionLabel className="mb-1.5 font-medium!">You’re paid</SectionLabel>
              <SegmentedControl label="How often you’re paid" options={PAY_FREQUENCIES} value={values.payFrequency} onChange={set("payFrequency")} />
            </div>
          <div className="mb-4">
            <label htmlFor="job-payday" className="mb-1.5 block text-sm font-medium">
              Any payday
            </label>
            <DatePicker id="job-payday" value={fromDateInput(values.payday)} onChange={(date) => set("payday")(toDateInput(date))} onClear={() => set("payday")("")} placeholder="Optional" />
            <p className="mt-1.5 text-xs text-pretty text-muted-foreground">Any one day you were (or will be) paid. Your timesheet’s pay periods are worked out from it.</p>
          </div>
          </div>

          <LocationField label="Where it is" value={values.place} onChange={set("place")} near={user.homeLocation ?? undefined} />

          <TextField
            label="Names on the schedule"
            placeholder="Optional — e.g. BH, Boathouse Yorkdale"
            maxLength={255}
            value={values.matchKeywords}
            onChange={(event) => set("matchKeywords")(event.target.value)}
            hint="Other names this workplace appears under. A scanned schedule uses them to pick this job."
          />

        </>
      )}
    </Sheet>
  );
}
