"use client";

import { BriefcaseBusiness, ClipboardPen, LogOut, Palette, Plus, ScanLine, Search, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { jobName, jobRole } from "@/lib/jobLabels";
import { useLogOut } from "@/lib/session";
import { openSheet } from "@/lib/sheets";
import { THEMES } from "@/lib/themes";
import { useMyJobs } from "@/lib/useMyJobs";
import { setTheme } from "../theme/useTheme";
import { ALL_PLACES } from "./nav";

interface Command {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  colour?: string;
  run: () => void;
}

/**
 * Ctrl/⌘ K: every place and action, by typing. It opens and closes with no
 * animation at all — a keyboard command used all day must never make you wait.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const logOut = useLogOut();
  const { data: jobs } = useMyJobs();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      { id: "new-shift", group: "Actions", label: "New shift", icon: Plus, run: () => openSheet({ kind: "shift" }) },
      { id: "scan", group: "Actions", label: "Scan a schedule photo", icon: ScanLine, run: () => openSheet({ kind: "scan" }) },
      { id: "new-job", group: "Actions", label: "New job", icon: BriefcaseBusiness, run: () => openSheet({ kind: "job" }) },
      { id: "hours", group: "Actions", label: "Add hours worked", icon: ClipboardPen, run: () => openSheet({ kind: "timeEntry" }) },
      ...ALL_PLACES.map((place) => ({ id: place.href, group: "Go to", label: place.label, icon: place.icon, run: () => router.push(place.href) })),
      ...(jobs ?? []).map((job) => ({ id: job.id, group: "Jobs", label: jobName(job), detail: jobRole(job) ?? undefined, icon: BriefcaseBusiness, colour: job.color, run: () => openSheet({ kind: "job", jobId: job.id }) })),
      ...THEMES.map((theme) => ({ id: theme.name, group: "Theme", label: theme.label, detail: theme.note, icon: Palette, run: () => setTheme(theme.name) })),
      { id: "log-out", group: "Account", label: "Log out", icon: LogOut, run: logOut },
    ],
    [jobs, router, logOut],
  );

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = commands.filter((command) => {
    const text = `${command.label} ${command.detail ?? ""} ${command.group}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const active = Math.min(index, Math.max(0, matches.length - 1));

  const choose = (command: Command) => {
    onClose();
    command.run();
  };

  const move = (step: number) => {
    if (matches.length === 0) return;
    const next = (active + step + matches.length) % matches.length;
    setIndex(next);
    list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Search"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent backdrop:bg-transparent"
    >
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="pointer-events-none absolute inset-0 flex justify-center px-4 pt-[14vh]">
        <div className="pointer-events-auto flex max-h-[min(28rem,70vh)] w-full max-w-xl flex-col overflow-hidden glass">
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined}
              aria-label="Search places and actions"
              placeholder="Search places and actions…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Enter" && matches[active]) {
                  event.preventDefault();
                  choose(matches[active]);
                }
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="rounded-[5px] px-1.5 py-px font-sans text-2xs font-medium text-muted-foreground shadow-[0_0_0_1px_var(--line)]">Esc</kbd>
          </div>

          <ul ref={list} id="command-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto overscroll-contain p-1.5">
            {matches.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</li>}
            {matches.map((command, position) => {
              const Icon = command.icon;
              const startsGroup = position === 0 || matches[position - 1].group !== command.group;
              return (
                <li key={command.id} role="presentation">
                  {startsGroup && <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold text-muted-foreground">{command.group}</p>}
                  <button
                    type="button"
                    role="option"
                    id={`command-${command.id}`}
                    data-index={position}
                    aria-selected={position === active}
                    tabIndex={-1}
                    onPointerMove={() => setIndex(position)}
                    onClick={() => choose(command)}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm ${position === active ? "bg-pressed" : ""}`}
                  >
                    {command.colour ? <span aria-hidden className="mx-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: command.colour }} /> : <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate font-medium">{command.label}</span>
                    {command.detail && <span className="truncate text-muted-foreground">{command.detail}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
