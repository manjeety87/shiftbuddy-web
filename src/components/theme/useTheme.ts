"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, DEFAULT_MODE, DEFAULT_THEME, isThemeMode, isThemeName, LEGACY_DARK_THEME, MODE_STORAGE_KEY, THEME_STORAGE_KEY, type ResolvedMode, type ThemeMode, type ThemeName } from "@/lib/themes";

// The look lives on <html data-theme data-mode> (set before paint by the boot
// script) and in localStorage. This file is the only writer, so every reader
// stays in step. `data-mode` is always the answer ("light" or "dark"); the
// choice, which may be "system", is what storage holds.

const listeners = new Set<() => void>();
const root = () => document.documentElement;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private window)
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice still applies for this visit
  }
};

const currentTheme = (): ThemeName => {
  const applied = root().dataset.theme;
  return isThemeName(applied) ? applied : DEFAULT_THEME;
};

// Kept in memory so a private window still remembers the choice until it closes
let chosenMode: ThemeMode | null = null;
const currentMode = (): ThemeMode => {
  if (chosenMode) return chosenMode;
  const saved = read(MODE_STORAGE_KEY);
  if (isThemeMode(saved)) return saved;
  // Someone who picked the old dark theme before modes existed chose dark
  return read(THEME_STORAGE_KEY) === LEGACY_DARK_THEME ? "dark" : DEFAULT_MODE;
};

const resolve = (mode: ThemeMode): ResolvedMode => (mode === "system" ? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light") : mode);
const currentResolvedMode = (): ResolvedMode => (root().dataset.mode === "dark" ? "dark" : "light");

const paint = () => {
  root().dataset.mode = resolve(currentMode());
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  // Another tab changed the look: follow it
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && isThemeName(event.newValue)) root().dataset.theme = event.newValue;
    if (event.key === MODE_STORAGE_KEY && isThemeMode(event.newValue)) chosenMode = event.newValue;
    if (event.key === THEME_STORAGE_KEY || event.key === MODE_STORAGE_KEY) paint();
  };
  // The device went dark (or light) while the page is open: "Auto" follows it
  const device = window.matchMedia(DARK_QUERY);
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  device.addEventListener("change", paint);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    device.removeEventListener("change", paint);
  };
};

export const setTheme = (theme: ThemeName) => {
  // Pin the mode first: once the old dark theme's name is overwritten, it can no longer say "dark"
  if (!isThemeMode(read(MODE_STORAGE_KEY))) setMode(currentMode());
  root().dataset.theme = theme;
  write(THEME_STORAGE_KEY, theme);
  paint();
};

export const setMode = (mode: ThemeMode) => {
  chosenMode = mode;
  write(MODE_STORAGE_KEY, mode);
  paint();
};

/** The theme in use. On the server it is the default; the saved one follows on hydration. */
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);
/** The choice: "system", "light" or "dark". */
export const useMode = () => useSyncExternalStore(subscribe, currentMode, () => DEFAULT_MODE);
/** What is on the page now: "light" or "dark". */
export const useResolvedMode = () => useSyncExternalStore(subscribe, currentResolvedMode, (): ResolvedMode => "light");
