# ShiftBuddy Web — interface system

What the interface is, in values. Read before adding a screen or a component; change
it here when a decision changes. The code is the source of truth for the numbers
(`src/app/globals.css`, `src/components/ui/`); this file says why.

## Who it is for

A student or part-timer in Canada with two or three jobs, checking between a class and
a bus: what is my next shift, do two of them clash, when do I leave, what will I be
paid. One person's own schedule — there are no managers, teams or admin views.

Feel: calm and warm, like a paper planner on a desk. Not a dashboard.

## Colour

- Four themes (Sunsama Focus, Clay Studio, Harbor Mist, Lavender Dusk), each a warm
  paper page + white cards + **one** muted accent, with a light and a dark side.
  `[data-theme]` + `[data-mode]` on `<html>`. A new theme needs both blocks.
- Token names follow shadcn/ui (`background`, `card`, `muted-foreground`, `primary`…).
  Never a raw hex or a Tailwind palette colour in a component.
- **Contrast is part of the token, not the call site.** On the page colour:
  `foreground`, `muted-foreground`, `primary`, `success`, `destructive`, `info` ≥ 4.5:1;
  white on `primary` ≥ 4.5:1; `faint` ≥ 3:1. Check a new theme against the same numbers.
- `faint` is for what is not read: chevrons, out-of-month days, disabled, rules.
  Words — placeholders and group labels included — use `muted-foreground`.
- Amber and red as words use `warning-ink` / `destructive-ink` (the fill mixed toward
  the text colour). `warning` / `destructive` themselves are for fills, rings and tints.
- A filled button under the pointer is `primary-hover` (it moves toward the text
  colour, so the label gains contrast in both modes). Never a lighter fill on hover.
- Job colours belong to the user's data; they mark a shift, never chrome.

## Type

- System UI face first (San Francisco / Segoe UI Variable), Inter as the fallback.
- Scale in `@theme`: 11 · 12 · 13 · 15 (body) · 17 · 20 · 24 · 28 · 36 · 48. Each size
  carries its own tracking and leading — don't add `tracking-*` at a call site.
- Hierarchy by weight and colour before size: value 600 / foreground, label 500,
  meta 400 / muted-foreground. Numbers that change or line up are `tabular-nums`.
- Headings `text-balance`, running copy `text-pretty`. Curly quotes and `’`, `…`, `–`.

## Space, shape, depth

- 4px grid. Page gutters 16 / 24 / 40px (phone / sm / lg). Content max 76rem.
- Radius: controls 8px (`rounded-lg`), cards 14px (`surface`), panels and glass 16px.
  A nested radius is the outer one minus the padding.
- Depth is one strategy: a hairline ring plus a soft shadow that grows with height —
  `shadow-card` → `shadow-pop` → `shadow-modal`. Borders only as dividers inside a surface.
- Materials: page (`background`) · sidebar (a step heavier) · `surface` (card) ·
  `glass` (what floats: menus, pickers, search). Never glass on glass.
- A list that is its own surface is one `surface` with hairline dividers, never a stack of cards.

## Controls

- Height 32px with a pointer, 40px on touch (`Button`, `inputClass`, `selectClass`).
  Small variant 28 / 32px. Icon 16px, sidebar icon 17px.
- `Button` variants: `primary` (one per view), `secondary`, `ghost`, `quiet`, `danger`.
- Fields: `TextField` / `TextArea` / `SelectField` wire label, hint, error and
  `aria-invalid` themselves. A bare `<select>` takes `selectClass`.
- Dates and times: `DatePicker` / `TimePicker`, never the browser's own inputs.
- Every interactive thing has rest, hover (pointer only: `pointer-fine:`), pressed,
  focus-visible (2px `primary` ring, 2px offset) and disabled.
- Data has loading (`SkeletonRows`, in the shape of what is coming), empty
  (`EmptyState`, with the next action) and error (`LoadError`, with Try Again).

## Dialogs and panels

- A form or detail is a `Sheet` (`openSheet`): a centred window with a pointer, a bottom
  sheet on a phone. One primary action, in the footer; Delete bottom left.
- A question is `showAlert` → `DialogHost` (`role="alertdialog"`): focus starts on the
  first button (the safe one — put Cancel first), Esc and a click outside answer
  Cancel, and one press answers once.
- **Log out** has one door: `useLogOut()` in `src/lib/session.tsx`. Title “Log out of
  ShiftBuddy?”, message “Are you sure you want to log out of your account?”, buttons
  Cancel · Log Out. Settings, the sidebar account menu and the search all call it.
- Outcomes are toasts (`notify`), never dialogs; inside a sheet, errors are inline (`FormError`).

## Motion

- Press: scale 0.97, 100–150ms. Popover / menu: 150–160ms from its trigger's corner.
  Panel: in 220ms, out 150ms; phone sheet 380 / 220ms. Easing `--ease-out` for
  entering, `--ease-in-out` for something moving on screen, `--ease-drawer` for sheets.
- No animation on page changes, section switches or the Ctrl K search.
- Only `transform` / `scale` / `translate`, `opacity`, colour and shadow are transitioned; never `all`.
- Reduced motion: movement is dropped (things arrive in place), colour and opacity stay.

## Layout

- ≥ 1024px sidebar (240px); 768–1023px icon rail (68px); < 768px bottom tab bar.
- Tables (Shifts, Timesheet) and the week / month boards exist from 768px; below
  that the same data is stacked rows and a day strip.
- `e2e/layout.mjs` walks every page and panel at 18 sizes (320 → 3440px); `e2e/phone.mjs` walks
  every page, panel and picker as a touch phone, with a 24×24 px minimum for anything pressable.
- On a phone: page titles wrap to two lines rather than cut a name off; facts that sat in a row
  pair up two-by-two; a long label gets a short form (`Breaks`, dates without "This week ·").
