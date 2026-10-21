"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Shift } from "@/interfaces/shift.d";

// Panels that open over a page (the mobile app's "sheets"). Anything can ask for
// one with `openSheet`; `SheetHost` in the app layout draws the stack. A sheet can
// open another on top of itself (a shift → its hours, a job picker → Add job).

export type SheetRequest =
  | { kind: "shift"; shiftId?: string; date?: Date }
  | { kind: "job"; jobId?: string }
  | { kind: "timeEntry"; entryId?: string; shiftId?: string; jobId?: string }
  | { kind: "copy"; shiftIds: string[] }
  | { kind: "copyWeek"; shifts: Shift[]; weekStart: Date }
  | { kind: "route"; shiftId: string }
  | { kind: "weather"; shiftId: string }
  | { kind: "conflict"; conflict: "overlap" | "travel"; fromId: string; toId: string }
  | { kind: "scan" }
  | { kind: "paySummary" }
  | { kind: "themes" }
  | { kind: "customTheme" }
  | { kind: "welcome" }
  | { kind: "shared"; ownerId: string; ownerName: string; date?: Date }
  | { kind: "verifyEmail" }
  | { kind: "password" }
  | { kind: "home" };

export interface OpenSheet {
  id: number;
  request: SheetRequest;
}

let stack: OpenSheet[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const publish = (next: OpenSheet[]) => {
  stack = next;
  listeners.forEach((listener) => listener());
};

export const openSheet = (request: SheetRequest) => publish([...stack, { id: nextId++, request }]);

export const closeSheet = (id: number) => publish(stack.filter((sheet) => sheet.id !== id));

/** Signing out: nothing from the last session may be waiting when the next one starts. */
export const closeAllSheets = () => publish([]);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const EMPTY: OpenSheet[] = [];

export const useOpenSheets = () => useSyncExternalStore(subscribe, () => stack, () => EMPTY);

// A screen shows one "add a shift" button, not three (the user's call, 2026-10-17). On
// a wide screen that is the sidebar's New shift (and N); pages with a picked day
// (Calendar, Home's week) lend it that day, so it still adds where the person is looking.
let pickedDay: Date | null = null;

export const usePickedDay = (day: Date) => {
  const time = day.getTime();
  useEffect(() => {
    pickedDay = new Date(time);
    return () => {
      pickedDay = null;
    };
  }, [time]);
};

export const openNewShift = () => openSheet(pickedDay ? { kind: "shift", date: pickedDay } : { kind: "shift" });
