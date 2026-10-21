"use client";

import { useSyncExternalStore } from "react";

// After someone deletes their account they land on the login page. This carries
// "it goes on <date>, log in to restore it" across that one trip, in this tab only.

const KEY = "shiftbuddy.deletionNotice";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null; // storage blocked: the email still says it
  }
};

const write = (purgeAt: string | null) => {
  try {
    if (purgeAt) sessionStorage.setItem(KEY, purgeAt);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to show, nothing to clear
  }
  listeners.forEach((listener) => listener());
};

export const showDeletionNotice = (purgeAt: string) => write(purgeAt);
export const clearDeletionNotice = () => write(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The day the account will be erased, while the notice is up; null otherwise (and on the server). */
export const useDeletionNotice = () => useSyncExternalStore(subscribe, read, () => null);

/** "November 19, 2026" in the reader's own words */
export const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });
