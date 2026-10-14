"use client";

import { Plus } from "lucide-react";
import { shortTime } from "@/components/ShiftRow";
import { isSameDay } from "@/lib/dateUtils";
import { addDays } from "@/lib/inputs";

/** A shift on Home's calendar — yours, or one from someone who shares their schedule with you. */
export interface BoardEntry {
  key: string;
  /** Whose shift it is: a `BoardPerson` id */
  personId: string;
  startTime: string;
  endTime: string;
  name: string;
  /** The job's colour */
  colour: string;
  open: () => void;
}

/** Someone on the calendar. Each person has one colour of their own, used wherever they are named. */
export interface BoardPerson {
  id: string;
  name: string;
  colour: string;
  /** Only your own days can take a new shift */
  isYou: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How many shifts a month cell names before it says "+2 more" */
const CELL_ENTRIES = 3;

const longDay = (day: Date) => day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const on = (entries: BoardEntry[], day: Date) => entries.filter((entry) => isSameDay(new Date(entry.startTime), day));

/**
 * A shift is a solid block of its job's colour — strong enough to read as an
 * object on the page, in the light themes and the dark one. Finished shifts fade.
 */
const chipStyle = (colour: string) => ({
  backgroundColor: `color-mix(in oklab, ${colour} 26%, var(--card))`,
  boxShadow: `inset 3px 0 0 ${colour}, 0 0 0 1px color-mix(in oklab, ${colour} 38%, transparent)`,
});

function Avatar({ person, className = "size-5 text-2xs" }: { person: BoardPerson; className?: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`} style={{ backgroundColor: person.colour }}>
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Quiet until the day is pointed at; always there for the keyboard and for touch.
 * On an empty day the whole cell is the button (its ::after covers the cell, which
 * must be `relative`): there is nothing else in it to press. A day with shifts keeps
 * the small + under them, so pressing a shift never adds one.
 */
function AddButton({ day, onAdd, wholeDay = false }: { day: Date; onAdd: (day: Date) => void; wholeDay?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Add a shift on ${longDay(day)}`}
      onClick={() => onAdd(day)}
      className={`mt-auto flex w-full shrink-0 items-center justify-center rounded-md text-faint transition-[opacity,background-color,color] duration-150 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:hover:text-foreground ${
        wholeDay ? "min-h-6 flex-1 after:absolute after:inset-0 after:transition-colors after:duration-150 after:content-[''] pointer-fine:hover:after:bg-hover" : "h-6 pointer-fine:hover:bg-hover"
      }`}
    >
      <Plus aria-hidden className="size-4" />
    </button>
  );
}

function WeekChip({ entry, now }: { entry: BoardEntry; now: number }) {
  const isNow = Date.parse(entry.startTime) <= now && Date.parse(entry.endTime) > now;
  return (
    <button
      type="button"
      onClick={entry.open}
      className={`w-full rounded-lg py-1.5 pr-2 pl-2.5 text-left transition-[scale,filter] duration-150 ease-out active:scale-[0.97] pointer-fine:hover:brightness-95 ${Date.parse(entry.endTime) <= now ? "opacity-55" : ""}`}
      style={chipStyle(entry.colour)}
    >
      <span className="line-clamp-2 text-sm leading-snug font-semibold wrap-break-word">{entry.name}</span>
      <span className="block text-xs text-foreground/75 tabular-nums">
        {shortTime(entry.startTime)} – {shortTime(entry.endTime)}
      </span>
      {isNow && <span className="mt-0.5 block text-2xs font-bold text-primary">Now</span>}
    </button>
  );
}

function DayHeading({ day, now }: { day: Date; now: number }) {
  const isToday = isSameDay(day, new Date(now));
  return (
    <span className="flex items-center justify-between px-2.5 py-2 text-xs font-medium text-muted-foreground">
      {WEEKDAYS[day.getDay()]}
      <span className={`flex size-6 items-center justify-center rounded-full text-sm tabular-nums ${isToday ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"}`}>{day.getDate()}</span>
    </span>
  );
}

/** Who is on the calendar. Each name is a switch: press to hide or show that person's shifts. */
export function PeopleFilter({ people, hidden, onToggle }: { people: BoardPerson[]; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  return (
    <div role="group" aria-label="Whose shifts are shown" className="mb-3 flex flex-wrap items-center gap-1.5">
      {people.map((person) => {
        const isShown = !hidden.has(person.id);
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={isShown}
            onClick={() => onToggle(person.id)}
            className={`flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-sm font-medium transition-[scale,background-color,color,box-shadow,opacity] duration-150 ease-out active:scale-95 md:h-7 ${
              isShown ? "bg-card text-foreground shadow-card" : "text-faint line-through opacity-70 shadow-[0_0_0_1px_var(--line)]"
            }`}
          >
            <Avatar person={person} className={`size-5 text-2xs ${isShown ? "" : "grayscale"}`} />
            {person.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The week on a wide screen. Alone, it is seven columns. With other people's
 * schedules on it, each person gets a row of their own — whose shift is whose is
 * answered by where it sits, before colour or a label has to be read.
 */
export function WeekBoard({ days, people, entries, now, onAdd }: { days: Date[]; people: BoardPerson[]; entries: BoardEntry[]; now: number; onAdd: (day: Date) => void }) {
  const tint = (day: Date) => (isSameDay(day, new Date(now)) ? "bg-primary/[0.07]" : "");

  if (people.length <= 1) {
    return (
      <div className="surface grid grid-cols-7 divide-x divide-border overflow-hidden">
        {days.map((day) => (
          <section key={day.getTime()} aria-label={longDay(day)} className={`group relative flex min-h-56 min-w-0 flex-col ${tint(day)}`}>
            <h3 className="border-b border-border">
              <DayHeading day={day} now={now} />
            </h3>
            <div className="flex flex-1 flex-col gap-1.5 p-1.5">
              {on(entries, day).map((entry) => (
                <WeekChip key={entry.key} entry={entry} now={now} />
              ))}
              {addDays(day, 1).getTime() > now && <AddButton day={day} onAdd={onAdd} wholeDay={on(entries, day).length === 0} />}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const columns = "grid grid-cols-[6.5rem_repeat(7,minmax(0,1fr))] lg:grid-cols-[8rem_repeat(7,minmax(0,1fr))]";
  return (
    <div role="table" aria-label="This week, by person" className="surface overflow-hidden">
      <div role="row" className={`${columns} divide-x divide-border border-b border-border`}>
        <span role="columnheader" />
        {days.map((day) => (
          <span key={day.getTime()} role="columnheader" aria-label={longDay(day)} className={tint(day)}>
            <DayHeading day={day} now={now} />
          </span>
        ))}
      </div>
      {people.map((person) => {
        const own = entries.filter((entry) => entry.personId === person.id);
        return (
          <div key={person.id} role="row" className={`${columns} divide-x divide-border border-b border-border last:border-b-0`}>
            <div role="rowheader" className="flex items-start gap-2 px-2.5 py-2.5" style={{ boxShadow: `inset 3px 0 0 ${person.colour}` }}>
              <Avatar person={person} className="size-6 text-xs" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{person.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {own.length} shift{own.length === 1 ? "" : "s"}
                </span>
              </span>
            </div>
            {days.map((day) => (
              <div key={day.getTime()} role="cell" className={`group relative flex min-h-24 min-w-0 flex-col gap-1.5 p-1.5 ${tint(day)}`}>
                {on(own, day).map((entry) => (
                  <WeekChip key={entry.key} entry={entry} now={now} />
                ))}
                {person.isYou && addDays(day, 1).getTime() > now && <AddButton day={day} onAdd={onAdd} wholeDay={on(own, day).length === 0} />}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The month as a grid that names its shifts. Someone else's shift carries their
 * initial in their colour, so two schedules stay apart even in a small cell. A day
 * with more than fits says how many are left; the week view shows them all.
 */
export function MonthBoard({ monthStart, people, entries, now, onAdd, onOpenDay }: { monthStart: Date; people: BoardPerson[]; entries: BoardEntry[]; now: number; onAdd: (day: Date) => void; onOpenDay: (day: Date) => void }) {
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((monthStart.getDay() + daysInMonth) / 7) * 7 }, (_, index) => addDays(gridStart, index));
  const others = new Map(people.filter((person) => !person.isYou).map((person) => [person.id, person]));

  return (
    <div className="surface overflow-hidden">
      <div aria-hidden className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="px-2.5 py-2">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((day) => {
          const isToday = isSameDay(day, new Date(now));
          const inMonth = day.getMonth() === monthStart.getMonth();
          const dayEntries = on(entries, day);
          return (
            <section key={day.getTime()} aria-label={longDay(day)} className={`group relative flex min-h-28 min-w-0 flex-col gap-1 p-1.5 ${isToday ? "bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]" : inMonth ? "bg-card" : "bg-card/55"}`}>
              <h3 className="flex">
                <span className={`flex size-6 items-center justify-center rounded-full text-sm tabular-nums ${isToday ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "" : "text-faint"}`}>{day.getDate()}</span>
              </h3>
              {dayEntries.slice(0, CELL_ENTRIES).map((entry) => {
                const owner = others.get(entry.personId);
                const described = `${owner ? `${owner.name} · ` : ""}${entry.name}, ${shortTime(entry.startTime)} – ${shortTime(entry.endTime)}`;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={entry.open}
                    title={described}
                    aria-label={described}
                    className={`flex h-6 w-full min-w-0 items-center gap-1.5 rounded-md pr-1.5 pl-2 text-left text-xs transition-[scale,filter] duration-150 ease-out active:scale-[0.97] pointer-fine:hover:brightness-95 ${Date.parse(entry.endTime) <= now ? "opacity-55" : ""}`}
                    style={chipStyle(entry.colour)}
                  >
                    {owner && <Avatar person={owner} className="size-4 text-[0.5625rem]" />}
                    <span className="shrink-0 font-semibold tabular-nums">{shortTime(entry.startTime)}</span>
                    <span className="truncate">{entry.name}</span>
                  </button>
                );
              })}
              {dayEntries.length > CELL_ENTRIES && (
                <button type="button" onClick={() => onOpenDay(day)} className="rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground row-hover">
                  +{dayEntries.length - CELL_ENTRIES} more
                </button>
              )}
              {addDays(day, 1).getTime() > now && <AddButton day={day} onAdd={onAdd} wholeDay={dayEntries.length === 0} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
