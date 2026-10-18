"use client";

import { BriefcaseBusiness, CalendarClock, CheckSquare, CircleDollarSign, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Checkbox, SelectButton, SelectionHeader } from "@/components/ui/SelectionHeader";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { Job } from "@/interfaces/job.d";
import { showAlert } from "@/lib/dialog";
import { splitAddress } from "@/lib/geocode";
import { formatMoney } from "@/lib/inputs";
import { deleteJob } from "@/lib/jobs";
import { jobName, jobRole } from "@/lib/jobLabels";
import { notify } from "@/lib/notify";
import { openSheet } from "@/lib/sheets";
import { useEscapeToStop, useLongPress } from "@/lib/useLongPress";
import { useMyJobs } from "@/lib/useMyJobs";

const fact = "flex items-center gap-2 text-sm";

/** One workplace as a card. What is missing is said plainly, because it switches a feature off. */
function JobCard({ job, selecting, picked, press, onToggle }: { job: Job; selecting: boolean; picked: boolean; press: ReturnType<typeof useLongPress>; onToggle: () => void }) {
  const role = jobRole(job);
  return (
    <button
      type="button"
      role={selecting ? "checkbox" : undefined}
      aria-checked={selecting ? picked : undefined}
      {...press.bind(job.id)}
      onClick={() => {
        if (press.consumeLongPress()) return;
        if (selecting) onToggle();
        else openSheet({ kind: "job", jobId: job.id });
      }}
      className={`surface group flex h-full w-full flex-col p-4 text-left select-none transition-[scale,box-shadow] duration-150 ease-out [-webkit-touch-callout:none] active:scale-[0.985] pointer-fine:hover:shadow-[0_0_0_1px_var(--line-strong),0_6px_18px_-8px_rgb(0_0_0/0.18)] ${picked ? "shadow-[0_0_0_2px_var(--primary)]!" : ""}`}
    >
      <span className="mb-4 flex items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-base font-bold text-white" style={{ backgroundColor: job.color }}>
          {jobName(job).charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg leading-tight font-semibold">{jobName(job)}</span>
          {role && <span className="block truncate text-sm text-muted-foreground">{role}</span>}
        </span>
        {selecting && (
          <span className="ml-auto">
            <Checkbox checked={picked} />
          </span>
        )}
      </span>

      <span className="mt-auto flex flex-col gap-1.5 border-t border-border pt-3">
        <span className={fact}>
          <CircleDollarSign aria-hidden className="size-4 shrink-0 text-faint" />
          {job.hourlyRate != null ? <span className="tabular-nums">{formatMoney(job.hourlyRate)} an hour</span> : <span className="text-muted-foreground">No hourly rate — pay can’t be estimated</span>}
        </span>
        <span className={fact}>
          <MapPin aria-hidden className="size-4 shrink-0 text-faint" />
          {job.location ? <span className="truncate">{splitAddress(job.location).title}</span> : <span className="text-muted-foreground">No location — no leave-by times</span>}
        </span>
        <span className={fact}>
          <CalendarClock aria-hidden className="size-4 shrink-0 text-faint" />
          <span className={job.payday ? "" : "text-muted-foreground"}>{job.payday ? `Paid ${job.payFrequency === "WEEKLY" ? "every week" : "every two weeks"}` : "Payday not set"}</span>
        </span>
      </span>
    </button>
  );
}

export function JobsPage() {
  const { data: jobs, error, retry } = useMyJobs();
  const addJob = () => openSheet({ kind: "job" });
  // Several jobs at once, as on the phone app: press and hold a card, or Select
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const pickedJobs = jobs?.filter((job) => picked.has(job.id)) ?? [];
  const allPicked = !!jobs?.length && pickedJobs.length === jobs.length;
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const press = useLongPress((id) => {
    setSelecting(true);
    setPicked((current) => new Set(current).add(id));
  });
  useEscapeToStop(selecting, stopSelecting);

  // A job takes its upcoming shifts with it and can't be brought back, so this one asks first
  const deletePicked = () => {
    const count = pickedJobs.length;
    showAlert(`Delete ${count} job${count === 1 ? "" : "s"}?`, "Their upcoming shifts are removed too. Shifts you already worked stay in your history. This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          let deleted = 0;
          try {
            for (const job of pickedJobs) {
              await deleteJob(job.id);
              deleted++;
            }
            notify.success(deleted === 1 ? "Job deleted" : `${deleted} jobs deleted`);
          } catch {
            notify.error(deleted ? `Only ${deleted} of ${count} jobs were deleted` : "Couldn’t delete — please try again");
          } finally {
            setDeleting(false);
            stopSelecting();
          }
        },
      },
    ]);
  };

  return (
    <>
      {selecting ? (
        <SelectionHeader count={pickedJobs.length} onDone={stopSelecting}>
          <Button variant="quiet" aria-label={allPicked ? "Deselect all" : "Select all"} icon={<CheckSquare aria-hidden className="size-4" />} onClick={() => setPicked(allPicked ? new Set() : new Set(jobs?.map((job) => job.id)))}>
            <span className="hidden sm:inline">{allPicked ? "Deselect all" : "Select all"}</span>
          </Button>
          <Button variant="danger" aria-label="Delete selected jobs" icon={<Trash2 aria-hidden className="size-4" />} busy={deleting} disabled={pickedJobs.length === 0} onClick={deletePicked}>
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </SelectionHeader>
      ) : (
        <PageHeader
          title="Jobs"
          description="Each place you work. Shifts, pay and travel times hang off these."
          actions={
            jobs && jobs.length > 0 ? (
              <>
                <SelectButton onClick={() => setSelecting(true)} />
                <Button aria-label="Add a job" icon={<Plus aria-hidden className="size-4" />} onClick={addJob}>
                  <span className="hidden sm:inline">Add Job</span>
                </Button>
              </>
            ) : undefined
          }
        />
      )}

      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : jobs === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonRows rows={1} className="h-44" />
          <SkeletonRows rows={1} className="h-44" />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Add your first job"
          action={
            <Button icon={<Plus aria-hidden className="size-4" />} onClick={addJob}>
              Add Job
            </Button>
          }
        >
          Each place you work is a job. Shifts, pay estimates and travel times all hang off it.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id} className="min-w-0">
              <JobCard job={job} selecting={selecting} picked={picked.has(job.id)} press={press} onToggle={() => toggle(job.id)} />
            </li>
          ))}
          <li className={selecting ? "hidden" : "hidden sm:block"}>
            <button
              type="button"
              onClick={addJob}
              className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-border-strong text-sm font-medium text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.985] pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
            >
              <Plus aria-hidden className="size-5" />
              Add another job
            </button>
          </li>
        </ul>
      )}
    </>
  );
}
