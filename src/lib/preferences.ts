"use client";

import { useSyncExternalStore } from "react";

// How this browser likes the app laid out. Not account data: it stays in
// localStorage (like the theme), so a shared computer and a phone can differ.
// Which parts of the app are on is account data (lib/features.ts).

const DEFAULTS = {
  /** Home's calendar: one week as columns, or the whole month */
  homeView: "week" as "week" | "month",
  /** The three welcome slides a new account sees once on this browser */
  welcomeSeen: "no" as "no" | "yes",
  /** Home's "Getting started" checklist, until it's done or hidden */
  gettingStarted: "shown" as "shown" | "hidden",
  /** What the assistant listens for: English, or Hindi (which also hears the English words in it) */
  assistantLanguage: "en-IN" as "en-IN" | "hi-IN",
  /** Whether the assistant reads its replies aloud */
  assistantVoice: "on" as "on" | "off",
};

type Preferences = typeof DEFAULTS;
type Key = keyof Preferences;

const storageKey = (key: Key) => `shiftbuddy.${key}`;
const listeners = new Set<() => void>();

const read = <K extends Key>(key: K): Preferences[K] => {
  try {
    const saved = localStorage.getItem(storageKey(key));
    // Only values this version knows; anything else (an old or edited entry) falls back
    if (key === "homeView" && (saved === "week" || saved === "month")) return saved as Preferences[K];
    if (key === "welcomeSeen" && (saved === "no" || saved === "yes")) return saved as Preferences[K];
    if (key === "gettingStarted" && (saved === "shown" || saved === "hidden")) return saved as Preferences[K];
    if (key === "assistantLanguage" && (saved === "en-IN" || saved === "hi-IN")) return saved as Preferences[K];
    if (key === "assistantVoice" && (saved === "on" || saved === "off")) return saved as Preferences[K];
  } catch {
    // Storage blocked (private window): the defaults apply
  }
  return DEFAULTS[key];
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener); // another tab changed it
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

export const setPreference = <K extends Key>(key: K, value: Preferences[K]) => {
  try {
    localStorage.setItem(storageKey(key), value);
  } catch {
    // Not saved, and so not applied either: the control shows what is really in effect
  }
  listeners.forEach((listener) => listener());
};

/** The saved choice; the default on the server and until one is made. */
export const usePreference = <K extends Key>(key: K): Preferences[K] =>
  useSyncExternalStore(
    subscribe,
    () => read(key),
    () => DEFAULTS[key],
  );

const subscribeToWidth = (query: string) => (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

/** True from tablet width up — where the sidebar, tables and calendar boards are drawn. */
export const useIsWide = () => {
  const query = "(min-width: 48rem)";
  return useSyncExternalStore(
    subscribeToWidth(query),
    () => window.matchMedia(query).matches,
    () => true,
  );
};
