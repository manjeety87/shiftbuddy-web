"use client";

import { Check, ChevronRight } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { openSheet } from "@/lib/sheets";
import { COLLECTIONS, MODES, THEMES, type ResolvedMode, type ThemeName } from "@/lib/themes";
import { setMode, setTheme, useMode, useResolvedMode, useTheme } from "./useTheme";

type Theme = (typeof THEMES)[number];

const ORIGINALS = THEMES.filter((theme) => theme.collection === "original");
const MORE = THEMES.filter((theme) => theme.collection !== "original");
// The fan on the "All themes" row: one from each of the other collections, so it hints at what's inside
const FAN: ThemeName[] = ["cupertinoBlue", "oxfordNavy", "deepForest"];

/**
 * Two choices that apply on click — a setting, so there is no separate "Apply":
 * light or dark (or follow the device), and the colour. Settings keeps the four
 * originals in view; the other collections are one row away, in their own panel,
 * so the section stays short and a first-time person isn't handed 16 choices.
 */
export function ThemePicker() {
  const current = useTheme();
  const shown = useResolvedMode();
  const currentTheme = THEMES.find((theme) => theme.name === current);
  const usingMore = currentTheme?.collection !== "original";

  return (
    <div className="flex flex-col gap-4">
      <ModeControl />

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORIGINALS.map((theme) => (
          <ThemeOption key={theme.name} theme={theme} isOn={theme.name === current} mode={shown} />
        ))}
      </div>

      {/* The whole row is the button: a bigger target than a link, and it says where the other 12 are */}
      <button
        type="button"
        onClick={() => openSheet({ kind: "themes" })}
        className="group flex min-h-14 w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left shadow-[0_0_0_1px_var(--line-strong)] transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.99] pointer-fine:hover:shadow-[0_0_0_1px_var(--faint)]"
      >
        <span aria-hidden className="flex shrink-0 -space-x-2">
          {(usingMore && currentTheme ? [currentTheme.name, ...FAN.filter((name) => name !== current).slice(0, 2)] : FAN).map((name) => (
            <span key={name} data-theme={name} data-mode={shown} className="flex size-7 items-center justify-center rounded-full bg-background shadow-[0_0_0_1.5px_var(--line-strong)]">
              <span className="size-3.5 rounded-full bg-primary" />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">All themes</span>
          <span className="block truncate text-xs text-muted-foreground">{usingMore && currentTheme ? `Using ${currentTheme.label}` : `${MORE.length} more in Apple-inspired and Elegant`}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint transition-transform duration-150 ease-out pointer-fine:group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

/** Every theme, by collection. Picking one applies it at once — the panel itself re-colours, so it is its own preview. */
export function ThemesSheet({ onClose }: { onClose: () => void }) {
  const current = useTheme();
  const shown = useResolvedMode();

  return (
    <Sheet title="Themes" onClose={onClose} wide>
      <ModeControl />
      {COLLECTIONS.map((collection) => {
        const themes = THEMES.filter((theme) => theme.collection === collection.id);
        return (
          <section key={collection.id} aria-labelledby={`themes-${collection.id}`} className="mt-6">
            <h3 id={`themes-${collection.id}`} className="mb-2.5 text-sm font-semibold">
              {collection.label} <span className="font-normal text-muted-foreground tabular-nums">{themes.length}</span>
            </h3>
            <div role="radiogroup" aria-labelledby={`themes-${collection.id}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {themes.map((theme) => (
                <ThemeOption key={theme.name} theme={theme} isOn={theme.name === current} mode={shown} />
              ))}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}

function ModeControl() {
  const mode = useMode();
  const shown = useResolvedMode();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-pretty text-muted-foreground">{mode === "system" ? `Auto follows this device — ${shown} right now.` : "Every colour has a light and a dark side."}</p>
      <SegmentedControl label="Light or dark" options={MODES} value={mode} onChange={setMode} className="w-full sm:w-64" />
    </div>
  );
}

/** A small picture of the app in that theme, drawn in the mode that is on now. */
function ThemeOption({ theme, isOn, mode }: { theme: Theme; isOn: boolean; mode: ResolvedMode }) {
  return (
    <button type="button" role="radio" aria-checked={isOn} title={theme.note} onClick={() => setTheme(theme.name)} className="group min-w-0 text-left transition-[scale] duration-150 ease-out active:scale-[0.97]">
      {/* The preview carries its own data-theme and data-mode, so it shows that theme's real colours */}
      <span
        data-theme={theme.name}
        data-mode={mode}
        aria-hidden
        className={`flex h-20 gap-1.5 overflow-hidden rounded-xl bg-background p-1.5 transition-shadow duration-150 ${isOn ? "shadow-[0_0_0_2px_var(--primary)]" : "shadow-[0_0_0_1px_var(--line-strong)] pointer-fine:group-hover:shadow-[0_0_0_1px_var(--faint)]"}`}
      >
        <span className="flex w-1/4 flex-col gap-1 rounded-md bg-sidebar p-1">
          <span className="h-1.5 rounded-full bg-primary" />
          <span className="h-1 rounded-full bg-muted" />
          <span className="h-1 rounded-full bg-muted" />
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="h-1/2 rounded-md bg-card shadow-[0_0_0_1px_var(--line)]" />
          <span className="flex flex-1 gap-1">
            <span className="flex-1 rounded-md bg-card shadow-[0_0_0_1px_var(--line)]" />
            <span className="w-1/3 rounded-md bg-primary" />
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-sm font-medium">
        <span className="truncate">{theme.label}</span>
        {isOn && <Check aria-hidden className="size-3.5 shrink-0 text-primary" />}
      </span>
    </button>
  );
}
