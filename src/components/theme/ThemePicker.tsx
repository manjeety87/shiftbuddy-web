"use client";

import { Check } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MODES, THEMES } from "@/lib/themes";
import { setMode, setTheme, useMode, useResolvedMode, useTheme } from "./useTheme";

/**
 * Two choices that apply on click — a setting, so there is no separate "Apply":
 * light or dark (or follow the device), and the colour. Each swatch is a small
 * picture of the app in that theme, drawn in the mode that is on now.
 */
export function ThemePicker() {
  const current = useTheme();
  const mode = useMode();
  const shown = useResolvedMode();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-pretty text-muted-foreground">{mode === "system" ? `Auto follows this device — ${shown} right now.` : "Every colour below has a light and a dark side."}</p>
        <SegmentedControl label="Light or dark" options={MODES} value={mode} onChange={setMode} className="w-full sm:w-64" />
      </div>

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {THEMES.map((theme) => {
          const isOn = theme.name === current;
          return (
            <button key={theme.name} type="button" role="radio" aria-checked={isOn} title={theme.note} onClick={() => setTheme(theme.name)} className="group min-w-0 text-left transition-[scale] duration-150 ease-out active:scale-[0.97]">
              {/* The preview carries its own data-theme and data-mode, so it shows that theme's real colours */}
              <span
                data-theme={theme.name}
                data-mode={shown}
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
        })}
      </div>
    </div>
  );
}
