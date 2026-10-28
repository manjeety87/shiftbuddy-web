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
  if (proposal.type === "editShift") return "Change shift";
  if (proposal.type === "removeShifts") return proposal.shiftIds.length === 1 ? "Remove shift" : `Remove ${proposal.shiftIds.length} shifts`;
  return proposal.type === "markMissed" ? "Mark missed" : "Add hours";
};

function ShiftLine({ jobName, role, color, startTime, endTime, detail, muted }: { jobName: string; role: string | null; color: string; startTime: string; endTime: string; detail?: string; muted?: boolean }) {
  return (
    <li className={`flex gap-3 py-2 first:pt-0 last:pb-0 ${muted ? "text-muted-foreground line-through decoration-muted-foreground/60" : ""}`}>
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: muted ? 0.45 : 1 }} />
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

const TITLES: { [Type in Proposal["type"]]: (proposal: Proposal) => string } = {
  addShifts: (proposal) => (proposal.type === "addShifts" && proposal.shifts.length > 1 ? `${proposal.shifts.length} new shifts` : "New shift"),
  editShift: () => "Change shift",
  removeShifts: (proposal) => (proposal.type === "removeShifts" && proposal.shiftIds.length > 1 ? `Remove ${proposal.shiftIds.length} shifts` : "Remove from schedule"),
  markMissed: () => "Mark as missed",
  logHours: () => "Hours worked",
};

const clashText = (overlaps: { jobName: string; startTime: string; endTime: string }[]) =>
  `Overlaps ${overlaps.map((shift) => `${shift.jobName}, ${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`).join(" and ")}.`;

function Clash({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2.5 flex gap-2 rounded-lg bg-warning/12 px-2.5 py-2 text-xs text-warning-ink">
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * What the assistant offers to save, before anything is saved: the person reads it
 * and says yes (or taps the button). It is the page's one primary action while it
 * waits, so it sits right above the place you talk or type.
 */
export function ProposalCard({ proposal, busy, listening, onSave, onDismiss }: { proposal: Proposal; busy: boolean; listening: boolean; onSave: () => void; onDismiss: () => void }) {
  const title = TITLES[proposal.type](proposal);

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
            <Clash>{proposal.shifts.length === 1 ? `${clashText(proposal.preview.overlaps)} Saving keeps both.` : "Some of these clash with shifts you already have; those are skipped."}</Clash>
          )}
        </>
      )}

      {proposal.type === "editShift" && (
        <>
          {/* Was → will be: the old line struck through, so the change reads at a glance */}
          <ul className="divide-y divide-border">
            <ShiftLine {...proposal.preview.before} detail="Now" muted />
            <ShiftLine {...proposal.preview.after} detail="Changes to" />
          </ul>
          {proposal.preview.overlaps.length > 0 && <Clash>{clashText(proposal.preview.overlaps)} Saving keeps both.</Clash>}
        </>
      )}

      {proposal.type === "removeShifts" && (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto overscroll-contain">
          {proposal.preview.shifts.map((shift) => (
            <ShiftLine key={shift.startTime} {...shift} detail={shift.missed ? "Missed" : undefined} muted />
          ))}
        </ul>
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
