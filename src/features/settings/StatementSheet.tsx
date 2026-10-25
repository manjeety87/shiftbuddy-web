"use client";

import { useRef, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormError, SectionLabel, SelectField } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/api";
import { toCalendarDateString } from "@/lib/dateUtils";
import { downloadStatement } from "@/lib/downloadStatement";
import { notify } from "@/lib/notify";
import type { StatementRange, StatementRequest } from "@/lib/shifts";
import { useMyJobs } from "@/lib/useMyJobs";
import { jobOptionLabel } from "../jobs/JobSelect";

type Choice = StatementRange | "custom";

const RANGES = [
  { value: "week", label: "Week" },
  { value: "twoWeeks", label: "2 Weeks" },
  { value: "month", label: "Month" },
  { value: "threeMonths", label: "3 Months" },
  { value: "custom", label: "Custom" },
] as const;

// "Which one" for a preset, in words; the PDF itself prints the exact dates (the backend owns them)
const WHICH: Record<StatementRange, string[]> = {
  week: ["This week", "Last week", "2 weeks ago", "3 weeks ago", "4 weeks ago", "5 weeks ago"],
  twoWeeks: ["This week and last", "3–4 weeks ago", "5–6 weeks ago", "7–8 weeks ago"],
  month: ["This month", "Last month", "2 months ago", "3 months ago", "4 months ago", "5 months ago"],
  threeMonths: ["This month and the 2 before", "The 3 months before that"],
};

/** Matches the backend's limit, so a long range is caught before the request */
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (date: Date) => toCalendarDateString(date.toISOString());

/**
 * A statement of the shifts worked, like a bank's e-statement: pick a week, two
 * weeks, a month, three months or any dates, and one job or all; Download saves
 * the PDF (every shift with its job, title, times and hours).
 */
export function StatementSheet({ jobId: initialJobId, onClose }: { jobId?: string; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const jobs = useMyJobs();
  const [range, setRange] = useState<Choice>("month");
  const [offset, setOffset] = useState(0);
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const today = new Date();
  const [from, setFrom] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  const customError = range !== "custom" ? null : days < 0 ? "The last day is before the first." : days >= MAX_DAYS ? "A statement covers at most a year." : null;

  const choose = (next: Choice) => {
    setRange(next);
    setOffset(0);
    setError(null);
  };

  const download = async () => {
    const request: StatementRequest = { ...(range === "custom" ? { range, from: iso(from), to: iso(to) } : { range, offset: -offset }), ...(jobId && { jobId }) };
    setBusy(true);
    setError(null);
    try {
      const filename = await downloadStatement(request);
      notify.success("Statement downloaded", { description: filename });
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t make the statement."));
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} title="Shift Statement" onClose={onClose} action={{ label: "Download", onClick: download, busy, disabled: !!customError }}>
      <p className="mb-4 text-sm text-pretty text-muted-foreground">Every shift you worked, with its job, title, times and hours — and pay, if pay estimates are on — as a PDF to keep or send.</p>
      <FormError>{error}</FormError>

      <SectionLabel>Period</SectionLabel>
      <SegmentedControl label="Period" options={RANGES} value={range} onChange={choose} className="mb-4 w-full" />
      {range === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker label="First day" value={from} onChange={setFrom} max={today} />
          <DatePicker label="Last day" value={to} onChange={setTo} max={today} />
          {customError && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {customError}
            </p>
          )}
        </div>
      ) : (
        <SelectField label="Which" value={offset} onChange={(event) => setOffset(Number(event.target.value))}>
          {WHICH[range].map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </SelectField>
      )}

      <div className="mt-4">
        <SelectField label="Jobs" value={jobId} onChange={(event) => setJobId(event.target.value)}>
          <option value="">All jobs</option>
          {jobs.data?.map((job) => (
            <option key={job.id} value={job.id}>
              {jobOptionLabel(job)}
            </option>
          ))}
        </SelectField>
      </div>
    </Sheet>
  );
}
