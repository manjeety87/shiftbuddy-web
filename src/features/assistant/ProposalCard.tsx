"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Proposal } from "@/lib/assistant";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { MISSED_REASONS } from "@/lib/missedShifts";
import { formatDuration } from "@/lib/shiftTime";

const minutesBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

/** The button says what will happen, and the reply after it uses the same verb */
export const saveLabel = (proposal: Proposal) => {
  if (proposal.type === "addShifts") return proposal.shifts.length === 1 ? "Add shift" : `Add ${proposal.shifts.length} shifts`;
  return proposal.type === "markMissed" ? "Mark missed" : "Add hours";
};

function ShiftLine({ jobName, role, color, startTime, endTime, detail }: { jobName: string; role: string | null; color: string; startTime: string; endTime: string; detail?: string }) {
  return (
    <li className="flex gap-3 py-2 first:pt-0 last:pb-0">
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3 text-sm font-semibold tabular-nums">
          <span>{formatDate(startTime)}</span>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDuration(minutesBetween(startTime, endTime))}</span>
        </p>
        <p className="text-sm tabular-nums">
          {formatTime(startTime)} – {formatTime(endTime)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {jobName}
          {role ? ` · ${role}` : ""}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * What the assistant offers to save, before anything is saved: the person reads it
 * and says yes (or taps the button). It is the page's one primary action while it
 * waits, so it sits right above the place you talk or type.
 */
export function ProposalCard({ proposal, busy, listening, onSave, onDismiss }: { proposal: Proposal; busy: boolean; listening: boolean; onSave: () => void; onDismiss: () => void }) {
  const title = proposal.type === "addShifts" ? (proposal.shifts.length === 1 ? "New shift" : `${proposal.shifts.length} new shifts`) : proposal.type === "markMissed" ? "Mark as missed" : "Hours worked";

  return (
    <section aria-label={title} className="assistant-card rounded-xl bg-card p-3.5 shadow-pop">
      <h3 className="mb-2.5 text-xs font-semibold text-muted-foreground">{title}</h3>

      {proposal.type === "addShifts" && (
        <>
          <ul className="max-h-48 divide-y divide-border overflow-y-auto overscroll-contain">
            {proposal.preview.shifts.map((shift) => (
              <ShiftLine key={shift.startTime} {...shift} detail={shift.notes ?? undefined} />
            ))}
          </ul>
          {proposal.preview.overlaps.length > 0 && (
            <p className="mt-2.5 flex gap-2 rounded-lg bg-warning/12 px-2.5 py-2 text-xs text-warning-ink">
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                {proposal.shifts.length === 1
                  ? `Overlaps ${proposal.preview.overlaps.map((shift) => `${shift.jobName}, ${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`).join(" and ")}. Saving keeps both.`
                  : "Some of these clash with shifts you already have; those are skipped."}
              </span>
            </p>
          )}
        </>
      )}

      {proposal.type === "markMissed" && (
        <ul>
          <ShiftLine {...proposal.preview} detail={MISSED_REASONS.find((option) => option.value === proposal.reason)?.short} />
        </ul>
      )}

      {proposal.type === "logHours" && (
        <ul>
          <ShiftLine
            {...proposal.preview}
            startTime={proposal.preview.clockIn}
            endTime={proposal.preview.clockOut}
            detail={`${proposal.preview.breakMinutes ? `${proposal.preview.breakMinutes} min break · ` : ""}${formatDuration(proposal.preview.paidMinutes)} paid`}
          />
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {/* Only while the microphone is on — never promise what won't work */}
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{listening ? "Say “yes”, or" : ""}</p>
        <Button variant="quiet" size="sm" onClick={onDismiss} disabled={busy}>
          Not now
        </Button>
        <Button size="sm" onClick={onSave} busy={busy}>
          {saveLabel(proposal)}
        </Button>
      </div>
    </section>
  );
}
