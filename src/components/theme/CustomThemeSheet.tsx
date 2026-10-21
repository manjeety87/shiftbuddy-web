"use client";

import { AlertTriangle, CalendarDays, Clock, Home, MapPin, Plus, Settings, Wallet } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";
import { inputClass, SelectField } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { CUSTOM_COLOURS, CUSTOM_SIDES, customThemeVariables, customThemeWarnings, normaliseHex, readThemeColours, sameCustomTheme, type CustomColour, type CustomSide, type CustomTheme } from "@/lib/customTheme";
import { notify } from "@/lib/notify";
import { COLLECTIONS, CUSTOM_LABEL, CUSTOM_THEME, THEMES } from "@/lib/themes";
import { saveCustomTheme, useCustomTheme, useResolvedMode, useTheme } from "./useTheme";

/**
 * Their own theme: four colours a side, and a made-up Home drawn in them as they
 * pick. The page behind keeps its theme until Save — the preview is the place to
 * look, so nothing changes under them while they experiment.
 */
export function CustomThemeSheet({ onClose }: { onClose: () => void }) {
  const saved = useCustomTheme();
  const current = useTheme();
  const shown = useResolvedMode();
  const sheet = useRef<SheetHandle>(null);
  // A first one starts from the theme on screen, so it begins somewhere that already works
  const [initial] = useState<CustomTheme>(() => saved ?? readThemeColours(current));
  const [colours, setColours] = useState(initial);
  const [side, setSide] = useState<CustomSide>(shown);

  const changed = !sameCustomTheme(colours, initial);
  const warnings = customThemeWarnings(colours[side]);
  const sideLabel = CUSTOM_SIDES.find((option) => option.value === side)?.label ?? "";

  const setColour = (key: CustomColour, value: string) => setColours((before) => ({ ...before, [side]: { ...before[side], [key]: value } }));

  return (
    <Sheet
      ref={sheet}
      title={saved ? `Edit ${CUSTOM_LABEL}` : "Make your own theme"}
      onClose={onClose}
      wide
      isDirty={changed}
      action={{
        label: "Save & Use",
        disabled: !!saved && !changed && current === CUSTOM_THEME,
        onClick: () => {
          saveCustomTheme(colours);
          notify.success(`${CUSTOM_LABEL} saved and in use`);
          sheet.current?.dismiss();
        },
      }}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="max-md:order-2">
          <SegmentedControl label="Which side to edit" options={CUSTOM_SIDES} value={side} onChange={setSide} className="mb-1.5 w-full" />
          <p className="mb-4 text-xs text-pretty text-muted-foreground">Light and dark each get their own colours. Auto switches between them with your device.</p>

          <SelectField
            label="Start from"
            value=""
            onChange={(event) => {
              if (event.target.value) setColours(readThemeColours(event.target.value));
            }}
          >
            <option value="">Pick a theme to copy…</option>
            {COLLECTIONS.map((collection) => (
              <optgroup key={collection.id} label={collection.label}>
                {THEMES.filter((theme) => theme.collection === collection.id).map((theme) => (
                  <option key={theme.name} value={theme.name}>
                    {theme.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>

          <div className="flex flex-col gap-3">
            {CUSTOM_COLOURS.map((colour) => (
              <ColourField key={`${side}-${colour.key}`} label={colour.label} hint={colour.hint} value={colours[side][colour.key]} onChange={(value) => setColour(colour.key, value)} />
            ))}
          </div>

          {warnings.length > 0 && (
            <ul aria-label={`${sideLabel}: hard to read`} className="mt-4 flex flex-col gap-2 rounded-lg bg-warning/12 p-3 text-xs text-pretty text-warning-ink">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="max-md:order-1 md:sticky md:top-0 md:self-start">
          <p className="mb-2 text-sm font-semibold">
            Preview <span className="font-normal text-muted-foreground">· Home, {sideLabel.toLowerCase()}</span>
          </p>
          <HomePreview colours={colours} side={side} />
          <p className="mt-2 text-xs text-muted-foreground">Made-up shifts, your colours.</p>
        </div>
      </div>
    </Sheet>
  );
}

/** A swatch that opens the system colour picker, and the hex code for typing or pasting one. */
function ColourField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  // The swatch or "Start from" changed it: show the new code
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setText(value);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--line-strong)] transition-[scale] duration-150 ease-out active:scale-95 md:size-9" style={{ backgroundColor: value }}>
        <span className="sr-only">{`${label} colour`}</span>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value.toLowerCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
          <span className="font-normal text-muted-foreground"> · {hint}</span>
        </label>
        <input
          id={id}
          value={text}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label={`${label} colour code`}
          onChange={(event) => {
            setText(event.target.value);
            // A full code applies as it is typed; a short one (#abc) waits for the field to be left
            const hex = event.target.value.replace(/^#?/, "#");
            if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toLowerCase());
          }}
          onBlur={() => {
            const hex = normaliseHex(text);
            if (hex) onChange(hex);
            setText(hex ?? value);
          }}
          className={`${inputClass} mt-1 font-mono uppercase`}
        />
      </div>
    </div>
  );
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DATES = [19, 20, 21, 22, 23, 24, 25];
const SHIFT_DAYS = new Set([1, 2, 4, 5]);
const SELECTED = 2;
// Job colours are picked per job, not by the theme, so the preview keeps fixed ones
const SHIFTS = [
  { job: "Tim Hortons", role: "Front counter", time: "9:00 AM – 2:30 PM", pay: "$95.70", colour: "#d97706" },
  { job: "Campus Library", role: "Desk assistant", time: "4:00 PM – 8:00 PM", pay: "$70.40", colour: "#2563eb" },
];
const NAV = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Shifts" },
  { icon: Clock, label: "Timesheet" },
  { icon: Wallet, label: "Pay" },
  { icon: Settings, label: "Settings" },
];

/** A made-up Home in the theme being made — only the theme's own tokens, so it is what the real pages will use. */
function HomePreview({ colours, side }: { colours: CustomTheme; side: CustomSide }) {
  return (
    <div
      role="img"
      aria-label="Preview of Home in these colours"
      data-theme={CUSTOM_THEME}
      data-mode={side}
      style={customThemeVariables(colours) as CSSProperties}
      className="flex min-h-80 overflow-hidden rounded-xl bg-background text-foreground shadow-[0_0_0_1px_var(--line-strong)] select-none"
    >
      <div aria-hidden className="hidden w-32 shrink-0 flex-col gap-0.5 border-r border-border bg-sidebar p-2 sm:flex">
        <p className="mb-2 px-2 pt-1 text-xs font-semibold">ShiftBuddy</p>
        {NAV.map(({ icon: Icon, label }, index) => (
          <span key={label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${index === 0 ? "bg-pressed font-medium text-foreground" : "text-muted-foreground"}`}>
            <Icon className={`size-3.5 ${index === 0 ? "text-primary" : ""}`} />
            {label}
          </span>
        ))}
      </div>

      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Good evening, Sam</p>
            <p className="truncate text-[11px] text-muted-foreground">2 shifts tomorrow · $166 this week</p>
          </div>
          <span className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground">
            <Plus className="size-3" />
            Add
          </span>
        </div>

        <div className="rounded-lg bg-primary p-3 text-primary-foreground">
          <p className="text-[10px] font-semibold tracking-wide opacity-80">NEXT SHIFT · TOMORROW</p>
          <p className="mt-1 truncate text-sm font-semibold">Tim Hortons</p>
          <p className="truncate text-[11px] opacity-85">9:00 AM – 2:30 PM · Front counter</p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="rounded-md bg-primary-well px-2 py-1 text-[11px] font-medium">Clock In</span>
            <span className="flex items-center gap-1 rounded-md bg-primary-well px-2 py-1 text-[11px]">
              <MapPin className="size-3" />
              Leave 8:25
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, index) => (
            <span key={index} className={`flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] ${index === SELECTED ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {day}
              <span className={`text-xs font-semibold ${index === SELECTED ? "" : "text-foreground"}`}>{DATES[index]}</span>
              <span className={`size-1 rounded-full ${SHIFT_DAYS.has(index) ? (index === SELECTED ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`} />
            </span>
          ))}
        </div>

        <p className="flex items-center gap-1.5 rounded-md bg-warning/12 px-2 py-1.5 text-[11px] text-warning-ink">
          <AlertTriangle className="size-3 shrink-0" />
          Thursday: two shifts overlap by 30 min
        </p>

        <div className="divide-y divide-border overflow-hidden rounded-lg bg-card shadow-card">
          {SHIFTS.map((shift) => (
            <div key={shift.job} className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: shift.colour }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{shift.job}</span>
                <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                  {shift.time} · {shift.role}
                </span>
              </span>
              <span className="text-[11px] font-medium text-success tabular-nums">{shift.pay}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex justify-end gap-1.5">
          <span className="rounded-md bg-card px-2 py-1 text-[11px] font-medium shadow-[0_0_0_1px_var(--line-strong)]">Copy week</span>
          <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">Review</span>
        </div>
      </div>
    </div>
  );
}
