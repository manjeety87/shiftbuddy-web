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
  if (proposal.type === "addJob") return "Add job";
  if (proposal.type === "editJob") return "Change job";
  if (proposal.type === "deleteJob") return "Delete job";
  if (proposal.type === "logHours") return proposal.entries.some((entry) => entry.entryId) ? "Save hours" : "Add hours";
  return "Mark missed";
};

const timeSpan = (start: string, end: string) => `${formatTime(start)} – ${formatTime(end)}`;

/**
 * One day's hours. The paid time leads, because it is the number the person said
 * ("8 hours 12 minutes"); clock-out and break are how it got there. Hours being
 * replaced sit under it, struck through.
 */
function HoursLine({ entry }: { entry: Extract<Proposal, { type: "logHours" }>["preview"]["entries"][number] }) {
  return (
    <li className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{formatDate(entry.startTime)}</span>
          <span className="shrink-0 text-base font-semibold tabular-nums">{formatDuration(entry.paidMinutes)} paid</span>
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {timeSpan(entry.clockIn, entry.clockOut)}
          {entry.breakMinutes ? ` · ${entry.breakMinutes} min break` : " · no break"}
        </p>
        {entry.before && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Replaces <span className="line-through decoration-muted-foreground/60">{entry.before.paidMinutes == null ? `${formatTime(entry.before.clockIn)}, still clocked in` : `${formatDuration(entry.before.paidMinutes)} · ${timeSpan(entry.before.clockIn, entry.before.clockOut)}`}</span>
          </p>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {entry.jobName}
          {entry.role ? ` · ${entry.role}` : ""}
        </p>
      </div>
    </li>
  );
}

function JobLine({ jobName, role, color, detail, muted }: { jobName: string; role: string | null; color: string; detail?: string; muted?: boolean }) {
  return (
    <li className={`flex gap-3 py-2 first:pt-0 last:pb-0 ${muted ? "text-muted-foreground line-through decoration-muted-foreground/60" : ""}`}>
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: muted ? 0.45 : 1 }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{jobName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {role ?? "No role"}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
    </li>
  );
}

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
  logHours: (proposal) => (proposal.type === "logHours" && proposal.entries.length > 1 ? `Hours worked on ${proposal.entries.length} shifts` : "Hours worked"),
  addJob: () => "New job",
  editJob: () => "Change job",
  deleteJob: () => "Delete job",
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
export function ProposalCard({ proposal, busy, listening, leaving = false, onSave, onDismiss }: { proposal: Proposal; busy: boolean; listening: boolean; leaving?: boolean; onSave: () => void; onDismiss: () => void }) {
  const title = TITLES[proposal.type](proposal);

  return (
    <section aria-label={title} aria-hidden={leaving || undefined} inert={leaving || undefined} data-leaving={leaving || undefined} className="assistant-card rounded-xl bg-card p-3.5 shadow-pop">
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
        <ul className="max-h-60 divide-y divide-border overflow-y-auto overscroll-contain">
          {proposal.preview.entries.map((entry) => (
            <HoursLine key={entry.startTime} entry={entry} />
          ))}
        </ul>
      )}

      {proposal.type === "addJob" && (
        <ul>
          <JobLine {...proposal.preview} />
        </ul>
      )}

      {proposal.type === "editJob" && (
        <ul className="divide-y divide-border">
          <JobLine {...proposal.preview.before} detail="Now" muted />
          <JobLine {...proposal.preview.after} detail="Changes to" />
        </ul>
      )}

      {proposal.type === "deleteJob" && (
        <>
          <ul>
            <JobLine {...proposal.preview} muted />
          </ul>
          {/* Deleting takes the upcoming shifts too: said before the yes, not after */}
          {proposal.preview.upcomingShifts > 0 && (
            <Clash>
              {proposal.preview.upcomingShifts === 1 ? "Its 1 upcoming shift is removed too." : `Its ${proposal.preview.upcomingShifts} upcoming shifts are removed too.`} Worked shifts stay in your history.
            </Clash>
          )}
        </>
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
