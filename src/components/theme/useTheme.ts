"use client";

import { useSyncExternalStore } from "react";
import { CUSTOM_STORAGE_KEY, CUSTOM_VARIABLES, customThemeVariables, parseCustomTheme, type CustomTheme } from "@/lib/customTheme";
import { CUSTOM_THEME, DARK_QUERY, DEFAULT_MODE, DEFAULT_TEXT_SIZE, DEFAULT_THEME, isLookName, isTextSize, isThemeMode, LEGACY_DARK_THEME, MODE_STORAGE_KEY, TEXT_SIZE_STORAGE_KEY, THEME_STORAGE_KEY, type LookName, type ResolvedMode, type TextSize, type ThemeMode } from "@/lib/themes";

// The look lives on <html data-theme data-mode> (set before paint by the boot
// script) and in localStorage. This file is the only writer, so every reader
// stays in step. `data-mode` is always the answer ("light" or "dark"); the
// choice, which may be "system", is what storage holds.
//
// Two layers: what is saved, and a preview. Picking in Appearance only previews —
// the whole page shows it, nothing is stored — until Save. Cancel, or leaving the
// screen, puts the saved look back.

export interface Look {
  theme: LookName;
  mode: ThemeMode;
  textSize: TextSize;
}

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

// Kept in memory so a private window still remembers the choice until it closes
let memory: Partial<Look> = {};
let customRaw: string | null | undefined;
let preview: Look | null = null;
/** Goes up on every save, so a panel closing later knows not to undo it */
let saves = 0;

const customTheme = (): CustomTheme | null => parseCustomTheme(customRaw === undefined ? read(CUSTOM_STORAGE_KEY) : customRaw);

const savedTheme = (): LookName => {
  if (memory.theme) return memory.theme;
  const saved = read(THEME_STORAGE_KEY);
  if (saved === CUSTOM_THEME) return customTheme() ? CUSTOM_THEME : DEFAULT_THEME;
  return isLookName(saved) ? saved : DEFAULT_THEME;
};
const savedMode = (): ThemeMode => {
  if (memory.mode) return memory.mode;
  const saved = read(MODE_STORAGE_KEY);
  if (isThemeMode(saved)) return saved;
  // Someone who picked the old dark theme before modes existed chose dark
  return read(THEME_STORAGE_KEY) === LEGACY_DARK_THEME ? "dark" : DEFAULT_MODE;
};

const savedTextSize = (): TextSize => {
  if (memory.textSize) return memory.textSize;
  const saved = read(TEXT_SIZE_STORAGE_KEY);
  return isTextSize(saved) ? saved : DEFAULT_TEXT_SIZE;
};

const shownTheme = (): LookName => preview?.theme ?? savedTheme();
const shownMode = (): ThemeMode => preview?.mode ?? savedMode();
const shownTextSize = (): TextSize => preview?.textSize ?? savedTextSize();

const resolve = (mode: ThemeMode): ResolvedMode => (mode === "system" ? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light") : mode);
const currentResolvedMode = (): ResolvedMode => (root().dataset.mode === "dark" ? "dark" : "light");

const paintCustom = () => {
  const theme = customTheme();
  const style = root().style;
  if (!theme) return CUSTOM_VARIABLES.forEach((name) => style.removeProperty(name));
  Object.entries(customThemeVariables(theme)).forEach(([name, value]) => style.setProperty(name, value));
};

const paint = () => {
  root().dataset.theme = shownTheme();
  root().dataset.mode = resolve(shownMode());
  const textSize = shownTextSize();
  if (textSize === DEFAULT_TEXT_SIZE) delete root().dataset.textSize;
  else root().dataset.textSize = textSize;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  // Another tab saved a look: follow it (a preview open here stays on screen)
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && isLookName(event.newValue)) memory.theme = event.newValue;
    if (event.key === MODE_STORAGE_KEY && isThemeMode(event.newValue)) memory.mode = event.newValue;
    if (event.key === TEXT_SIZE_STORAGE_KEY && isTextSize(event.newValue)) memory.textSize = event.newValue;
    if (event.key === CUSTOM_STORAGE_KEY) {
      customRaw = event.newValue;
      paintCustom();
    }
    if (event.key === THEME_STORAGE_KEY || event.key === MODE_STORAGE_KEY || event.key === TEXT_SIZE_STORAGE_KEY || event.key === CUSTOM_STORAGE_KEY) paint();
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

const save = (look: Look) => {
  memory = { ...look };
  write(THEME_STORAGE_KEY, look.theme);
  write(MODE_STORAGE_KEY, look.mode);
  write(TEXT_SIZE_STORAGE_KEY, look.textSize);
  preview = null;
  saves += 1;
  paint();
};

/** Show a theme or a mode on the whole page without saving it. */
export const previewLook = (change: Partial<Look>) => {
  preview = { theme: shownTheme(), mode: shownMode(), textSize: shownTextSize(), ...change };
  if (preview.theme === savedTheme() && preview.mode === savedMode() && preview.textSize === savedTextSize()) preview = null;
  paint();
};

/** Keep what is being previewed. */
export const savePreview = () => {
  if (preview) save(preview);
};

/** Back to the saved look. */
export const discardPreview = () => {
  if (!preview) return;
  preview = null;
  paint();
};

/**
 * Where a panel's preview started, to go back to if it is cancelled. Undoing
 * only if nothing was saved in between, so closing a panel never reverts a save.
 */
export const previewCheckpoint = () => {
  const at = { preview, saves };
  return () => {
    if (saves !== at.saves) return;
    preview = at.preview;
    paint();
  };
};

/** Straight to saved, for an explicit command (the Ctrl K search) rather than a picker. */
export const setTheme = (theme: LookName) => save({ theme, mode: shownMode(), textSize: shownTextSize() });

/** Save their own colours and switch to them, keeping the light/dark choice on screen. */
export const saveCustomTheme = (theme: CustomTheme) => {
  customRaw = JSON.stringify(customThemeVariables(theme));
  write(CUSTOM_STORAGE_KEY, customRaw);
  paintCustom();
  save({ theme: CUSTOM_THEME, mode: shownMode(), textSize: shownTextSize() });
};

/** The theme on the page, preview included. On the server it is the default; the saved one follows on hydration. */
export const useTheme = () => useSyncExternalStore(subscribe, shownTheme, () => DEFAULT_THEME);
/** The light/dark choice on the page: "system", "light" or "dark". */
export const useMode = () => useSyncExternalStore(subscribe, shownMode, () => DEFAULT_MODE);
/** The text size on the page, preview included. */
export const useTextSize = () => useSyncExternalStore(subscribe, shownTextSize, () => DEFAULT_TEXT_SIZE);
/** What is on the page now: "light" or "dark". */
export const useResolvedMode = () => useSyncExternalStore(subscribe, currentResolvedMode, (): ResolvedMode => "light");
/** True while something is previewed and not saved. */
export const useIsPreviewing = () => useSyncExternalStore(subscribe, () => preview !== null, () => false);

let customSnapshot: { raw: string | null; theme: CustomTheme | null } = { raw: null, theme: null };
const currentCustomTheme = () => {
  const raw = customRaw === undefined ? read(CUSTOM_STORAGE_KEY) : customRaw;
  // Same object until the saved text changes, as useSyncExternalStore needs
  if (raw !== customSnapshot.raw) customSnapshot = { raw, theme: parseCustomTheme(raw) };
  return customSnapshot.theme;
};
/** Their own theme's colours, or null before they make one. */
export const useCustomTheme = () => useSyncExternalStore(subscribe, currentCustomTheme, () => null);
