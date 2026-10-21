"use client";

import { Check, ChevronRight, Paintbrush } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { notify } from "@/lib/notify";
import { openSheet } from "@/lib/sheets";
import { COLLECTIONS, CUSTOM_LABEL, CUSTOM_THEME, MODES, THEMES, type LookName, type ResolvedMode, type ThemeName } from "@/lib/themes";
import { discardPreview, previewCheckpoint, previewLook, savePreview, useCustomTheme, useIsPreviewing, useMode, useResolvedMode, useTheme } from "./useTheme";

const ORIGINALS = THEMES.filter((theme) => theme.collection === "original");
const MORE = THEMES.filter((theme) => theme.collection !== "original");
// The fan on the "All themes" row: one from each of the other collections, so it hints at what's inside
const FAN: ThemeName[] = ["cupertinoBlue", "oxfordNavy", "deepForest"];

const lookLabel = (name: LookName) => (name === CUSTOM_THEME ? CUSTOM_LABEL : (THEMES.find((theme) => theme.name === name)?.label ?? ""));

/**
 * Light or dark (or follow the device), and the colour. Picking previews it on the
 * whole page; nothing is kept until Save, so trying themes never changes the app
 * by accident. Settings keeps the four originals in view; the other collections
 * and their own theme are one row away, so a first-time person isn't handed 17 choices.
 */
export function ThemePicker() {
  const current = useTheme();
  const shown = useResolvedMode();
  const usingMore = MORE.some((theme) => theme.name === current);

  // Leaving Settings without saving puts the saved look back
  useEffect(() => discardPreview, []);

  return (
    <div className="flex flex-col gap-4">
      <ModeControl />

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORIGINALS.map((theme) => (
          <ThemeOption key={theme.name} name={theme.name} label={theme.label} note={theme.note} isOn={theme.name === current} mode={shown} />
        ))}
      </div>

      {/* The whole row is the button: a bigger target than a link, and it says where the other 12 are */}
      <RowButton
        onClick={() => openSheet({ kind: "themes" })}
        art={
          <span aria-hidden className="flex shrink-0 -space-x-2">
            {(usingMore ? [current, ...FAN.filter((name) => name !== current).slice(0, 2)] : FAN).map((name) => (
              <span key={name} data-theme={name} data-mode={shown} className="flex size-7 items-center justify-center rounded-full bg-background shadow-[0_0_0_1.5px_var(--line-strong)]">
                <span className="size-3.5 rounded-full bg-primary" />
              </span>
            ))}
          </span>
        }
        title="All themes"
        detail={usingMore ? `Using ${lookLabel(current)}` : `${MORE.length} more in Apple-inspired and Elegant`}
      />
      <CustomRow />

      <PreviewBar />
    </div>
  );
}

/** Their own theme: make one, or — once made — pick it and edit it. */
function CustomRow() {
  const custom = useCustomTheme();
  const current = useTheme();
  const shown = useResolvedMode();

  if (!custom) {
    return (
      <RowButton
        onClick={() => openSheet({ kind: "customTheme" })}
        art={
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Paintbrush className="size-3.5" />
          </span>
        }
        title="Make your own"
        detail="Pick the page, card, text and accent colours"
      />
    );
  }

  const isOn = current === CUSTOM_THEME;
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl bg-card py-2.5 pr-2.5 pl-3 shadow-[0_0_0_1px_var(--line-strong)]">
      <button type="button" role="radio" aria-checked={isOn} onClick={() => previewLook({ theme: CUSTOM_THEME })} className="flex min-w-0 flex-1 items-center gap-3 text-left transition-[scale] duration-150 ease-out active:scale-[0.99]">
        <span aria-hidden data-theme={CUSTOM_THEME} data-mode={shown} className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-background ${isOn ? "shadow-[0_0_0_2px_var(--primary)]" : "shadow-[0_0_0_1.5px_var(--line-strong)]"}`}>
          <span className="size-3.5 rounded-full bg-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {CUSTOM_LABEL}
            {isOn && <Check aria-hidden className="size-3.5 shrink-0 text-primary" />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">Your own colours</span>
        </span>
      </button>
      <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "customTheme" })}>
        Edit
      </Button>
    </div>
  );
}

/** Shows up only while a pick is on screen but not kept: what it is, and the two ways out. */
function PreviewBar() {
  const previewing = useIsPreviewing();
  const current = useTheme();
  const mode = useMode();
  if (!previewing) return null;

  const modeLabel = MODES.find((option) => option.value === mode)?.label ?? "";
  return (
    <div role="status" className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-card px-3.5 py-2.5 shadow-pop max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Previewing {lookLabel(current)}</span>
        <span className="text-muted-foreground"> · {modeLabel} · not saved</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={discardPreview}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            savePreview();
            notify.success("Theme saved");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** Every theme, by collection. Picking one previews it — the panel itself re-colours, so it is its own preview — and Save keeps it. */
export function ThemesSheet({ onClose }: { onClose: () => void }) {
  const current = useTheme();
  const shown = useResolvedMode();
  const custom = useCustomTheme();
  const previewing = useIsPreviewing();
  const sheet = useRef<SheetHandle>(null);
  // Cancel goes back to how the page looked when the panel opened
  const [undo] = useState(previewCheckpoint);
  useEffect(() => undo, [undo]);

  return (
    <Sheet
      ref={sheet}
      title="Themes"
      onClose={onClose}
      wide
      action={{
        disabled: !previewing,
        onClick: () => {
          savePreview();
          notify.success("Theme saved");
          sheet.current?.dismiss();
        },
      }}
    >
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
                <ThemeOption key={theme.name} name={theme.name} label={theme.label} note={theme.note} isOn={theme.name === current} mode={shown} />
              ))}
            </div>
          </section>
        );
      })}
      <section aria-labelledby="themes-yours" className="mt-6">
        <h3 id="themes-yours" className="mb-2.5 text-sm font-semibold">
          Yours
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {custom && (
            <div role="radiogroup" aria-labelledby="themes-yours">
              <ThemeOption name={CUSTOM_THEME} label={CUSTOM_LABEL} note="Your own colours" isOn={current === CUSTOM_THEME} mode={shown} />
            </div>
          )}
          <button type="button" onClick={() => openSheet({ kind: "customTheme" })} className="group min-w-0 text-left transition-[scale] duration-150 ease-out active:scale-[0.97]">
            <span className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border-strong text-muted-foreground transition-colors duration-150 pointer-fine:group-hover:border-faint pointer-fine:group-hover:text-foreground">
              <Paintbrush aria-hidden className="size-5" />
            </span>
            <span className="mt-2 block truncate text-sm font-medium">{custom ? `Edit ${CUSTOM_LABEL}` : "Make your own"}</span>
          </button>
        </div>
      </section>
    </Sheet>
  );
}

function ModeControl() {
  const mode = useMode();
  const shown = useResolvedMode();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-pretty text-muted-foreground">{mode === "system" ? `Auto follows this device — ${shown} right now.` : "Every colour has a light and a dark side."}</p>
      <SegmentedControl label="Light or dark" options={MODES} value={mode} onChange={(value) => previewLook({ mode: value })} className="w-full sm:w-64" />
    </div>
  );
}

function RowButton({ onClick, art, title, detail }: { onClick: () => void; art: ReactNode; title: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-14 w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left shadow-[0_0_0_1px_var(--line-strong)] transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.99] pointer-fine:hover:shadow-[0_0_0_1px_var(--faint)]"
    >
      {art}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-faint transition-transform duration-150 ease-out pointer-fine:group-hover:translate-x-0.5" />
    </button>
  );
}

/** A small picture of the app in that theme, drawn in the mode that is on now. */
function ThemeOption({ name, label, note, isOn, mode }: { name: LookName; label: string; note: string; isOn: boolean; mode: ResolvedMode }) {
  return (
    <button type="button" role="radio" aria-checked={isOn} title={note} onClick={() => previewLook({ theme: name })} className="group w-full min-w-0 text-left transition-[scale] duration-150 ease-out active:scale-[0.97]">
      {/* The preview carries its own data-theme and data-mode, so it shows that theme's real colours */}
      <span
        data-theme={name}
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
        <span className="truncate">{label}</span>
        {isOn && <Check aria-hidden className="size-3.5 shrink-0 text-primary" />}
      </span>
    </button>
  );
}
