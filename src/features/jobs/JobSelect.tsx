"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionLabel, SelectField } from "@/components/ui/Field";
import type { Job } from "@/interfaces/job.d";
import { jobName, jobRole } from "@/lib/jobLabels";
import { openSheet } from "@/lib/sheets";

/** "Boathouse — Sales Associate": the workplace first, the role only when it adds something. */
export const jobOptionLabel = (job: Pick<Job, "title" | "companyName">) => {
  const role = jobRole(job);
  return role ? `${jobName(job)} — ${role}` : jobName(job);
};

/** Which job a shift or some hours belong to. With no jobs yet it offers the way to add one, right here. */
export function JobSelect({ jobs, value, onChange, error }: { jobs: Job[] | null; value: string | null; onChange: (jobId: string) => void; error?: string | null }) {
  if (jobs && jobs.length === 0) {
    return (
      <div className="mb-4">
        <SectionLabel>Job</SectionLabel>
        <div className="flex items-center gap-3 surface px-4 py-3.5">
          <p className="flex-1 text-sm text-muted-foreground">Add the job this is for first.</p>
          <Button variant="secondary" size="sm" icon={<Plus aria-hidden className="size-3.5" />} onClick={() => openSheet({ kind: "job" })}>
            Add Job
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SelectField label="Job" value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={!jobs} error={error}>
      {/* No silent default when there is a real choice to make */}
      {!value && <option value="">{jobs ? "Choose a job" : "Loading…"}</option>}
      {jobs?.map((job) => (
        <option key={job.id} value={job.id}>
          {jobOptionLabel(job)}
        </option>
      ))}
    </SelectField>
  );
}
