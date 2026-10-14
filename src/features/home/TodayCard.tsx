"use client";

import { ChevronRight } from "lucide-react";
import { formatShiftTimes, isHappeningNow, NowBadge } from "@/components/ShiftRow";
import { formatTime } from "@/lib/dateUtils";
import { formatDayLabel } from "@/lib/inputs";
import { jobName } from "@/lib/jobLabels";

interface PersonShift {
  id: string;
  startTime: string;
  endTime: string;
  job: { title: string; companyName: string; color: string };
}

export interface PersonToday {
  id: string;
  name: string;
  /** The person's own colour — the same one their row of the calendar carries */
  colour: string;
  /** Shifts that touch today, earliest first */
  today: PersonShift[];
  /** Their next shift that isn't over yet — shown when today is free */
  next: PersonShift | null;
  /** Someone else's row opens their week; yours has nothing more to open */
  open?: () => void;
}

/**
 * Today, person by person: who is working, where and until when — or that they're
 * off, and when they next work. The question two people sharing schedules ask
 * most ("are you working today?") answered without reading a calendar.
 */
export function TodayCard({ people, now, className = "" }: { people: PersonToday[]; now: number; className?: string }) {
  if (people.length === 0) return null;

  return (
    <section aria-label="Today" className={`flex flex-col ${className}`}>
      <h2 className="mb-2.5 text-sm font-semibold">Today</h2>
      <div className="surface flex-1 divide-y divide-border overflow-hidden">
        {people.map((person) => {
          const body = (
            <>
              <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: person.colour }}>
                {person.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{person.name}</span>
                {person.today.length === 0 ? (
                  <span className="block text-xs text-pretty text-muted-foreground">
                    Off today
                    {person.next && ` · next ${formatDayLabel(new Date(person.next.startTime), new Date(now))}, ${formatTime(person.next.startTime)}`}
                  </span>
                ) : (
                  person.today.map((shift) => (
                    <span key={shift.id} className={`mt-1 flex items-start gap-2 ${Date.parse(shift.endTime) <= now ? "opacity-55" : ""}`}>
                      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: shift.job.color }} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm">{jobName(shift.job)}</span>
                          {isHappeningNow(shift, now) && <NowBadge />}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{formatShiftTimes(shift)}</span>
                      </span>
                    </span>
                  ))
                )}
              </span>
              {person.open && <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-faint" />}
            </>
          );
          const shape = "flex w-full items-start gap-3 px-3.5 py-3 text-left";
          return person.open ? (
            <button key={person.id} type="button" onClick={person.open} className={`${shape} row-hover`}>
              {body}
            </button>
          ) : (
            <div key={person.id} className={shape}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export interface ComingUp {
  key: string;
  startTime: string;
  endTime: string;
  name: string;
  colour: string;
  /** First name of whose shift it is; absent for your own */
  owner?: string;
  open: () => void;
}

/** After today: the next few shifts across everyone on the calendar, soonest first. */
export function ComingUpCard({ entries, now, className = "" }: { entries: ComingUp[]; now: number; className?: string }) {
  if (entries.length === 0) return null;

  return (
    <section aria-label="Coming up" className={`flex flex-col ${className}`}>
      <h2 className="mb-2.5 text-sm font-semibold">Coming up</h2>
      <div className="surface divide-y divide-border overflow-hidden">
        {entries.map((entry) => (
          <button key={entry.key} type="button" onClick={entry.open} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left row-hover">
            <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: entry.colour }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {entry.owner && <span className="text-muted-foreground">{entry.owner} · </span>}
                {entry.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                {formatDayLabel(new Date(entry.startTime), new Date(now))} · {formatShiftTimes(entry)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
