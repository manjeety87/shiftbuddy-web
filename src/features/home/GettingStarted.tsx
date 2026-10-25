"use client";

import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { setPreference } from "@/lib/preferences";
import { openSheet } from "@/lib/sheets";

export interface GettingStartedProgress {
  hasJob: boolean;
  hasShift: boolean;
  /** undefined: leave-by times are switched off, so the step isn't offered */
  hasHome?: boolean;
  /** undefined: the timesheet is switched off */
  hasClockedIn?: boolean;
}

interface Step {
  done: boolean;
  title: string;
  /** What it gets you, said once in plain words */
  hint: string;
  /** Where the step is done; none for a step that happens on its own later */
  open?: () => void;
  /** Two ways to do it, as buttons in the row instead of one tap target */
  choices?: { label: string; onClick: () => void }[];
}

/**
 * The first four things that make ShiftBuddy useful, in the order they unlock
 * each other. Each row opens the place it's done; a tick appears once the data
 * says it's done (never by tapping). Leaves Home when all four are done or
 * when hidden. The phone app's Home has the same card.
 */
export function GettingStarted({ progress }: { progress: GettingStartedProgress }) {
  // A step for a feature that's switched off is null and left out
  const candidates: (Step | null)[] = [
    { done: progress.hasJob, title: "Add your job", hint: "Each place you work, once. Shifts, pay and travel hang off it.", open: () => openSheet({ kind: "job" }) },
    {
      done: progress.hasShift,
      title: "Add or scan your shifts",
      hint: "Type one in, or upload a photo of your schedule and we read it.",
      // A shift needs a job first, so until then this waits its turn
      choices: progress.hasJob
        ? [
            { label: "Add", onClick: () => openSheet({ kind: "shift" }) },
            { label: "Scan", onClick: () => openSheet({ kind: "scan" }) },
          ]
        : undefined,
    },
    progress.hasHome === undefined ? null : { done: progress.hasHome, title: "Set your home address", hint: "So we can tell you when to leave for each shift.", open: () => openSheet({ kind: "home" }) },
    progress.hasClockedIn === undefined ? null : { done: progress.hasClockedIn, title: "Clock in at a shift", hint: "The Clock In button shows on your next shift 10 minutes before it starts." },
  ];
  const steps = candidates.filter((step): step is Step => step !== null);
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section aria-labelledby="getting-started-title" className="surface mb-7 overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 id="getting-started-title" className="text-base font-semibold">
            Getting started
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <button type="button" onClick={() => setPreference("gettingStarted", "hidden")} className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground">
          Hide
        </button>
      </div>
      <div aria-hidden className="mx-4 mb-1 h-1 overflow-hidden rounded-full bg-muted/70">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className="divide-y divide-border">
        {steps.map((step) => {
          const body = (
            <>
              <span
                aria-hidden
                className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200 ease-out ${step.done ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
              >
                {step.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${step.done ? "text-muted-foreground line-through decoration-faint" : ""}`}>{step.title}</span>
                {!step.done && <span className="block text-xs text-pretty text-muted-foreground">{step.hint}</span>}
              </span>
              {step.open && !step.done && <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />}
              {step.choices && !step.done && (
                <span className="flex shrink-0 gap-1.5">
                  {step.choices.map((choice) => (
                    <Button key={choice.label} variant="secondary" size="sm" onClick={choice.onClick}>
                      {choice.label}
                    </Button>
                  ))}
                </span>
              )}
            </>
          );
          return (
            <li key={step.title}>
              <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
              {step.open && !step.done ? (
                <button type="button" onClick={step.open} className="flex w-full items-center gap-3 px-4 py-3 text-left row-hover">
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
