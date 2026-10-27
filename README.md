# ShiftBuddy Web

The ShiftBuddy app in a browser: every shift from every job in one place. It is a
client only — it fetches and formats. Every rule (overlaps, travel conflicts, pay,
leave-by times, sharing permissions, weather advice) comes from `shiftbuddy-backend`.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.
Read `AGENTS.md` before changing anything: Next 16 differs from older versions.

## Run it

```bash
# 1. the backend, in ../shiftbuddy-backend
npm run dev                      # http://localhost:5000

# 2. this app
cp .env.example .env.local       # only if the backend is somewhere else
npm install
npm run dev                      # http://localhost:3000
```

| Setting | What it is |
| --- | --- |
| `API_URL` | Where the backend runs. Default `http://localhost:5000`. Server-side only. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional. A Google OAuth **Web** client id turns on "Continue with Google". The backend must accept the same id. |

## How it is put together

```
src/
  app/(auth)/        login, register, forgot-password
  app/(app)/         home, shifts, calendar, jobs, timesheet, sharing, settings
  features/<area>/   each page and its panels (shifts, jobs, timesheet, commute, …)
  components/ui/     Button, Field, Sheet, SegmentedControl, DialogHost, States
  components/shell/  sidebar, phone tab bar, SheetHost
  lib/               API calls and helpers — the same files as the mobile app's lib/
  interfaces/        the API's shapes (copied from the mobile app)
e2e/                 real-browser walk-throughs
```

**Talking to the backend.** The browser only calls `/api/...` on this site;
`next.config.ts` forwards that to `API_URL`. That keeps the refresh cookie
first-party. `lib/api.ts` is the one door: it adds the access token, and on a 401
does one shared refresh and retries.

**Being signed in.** The access token lives in memory only. The refresh token is an
httpOnly cookie the backend sets (this app sends `X-Auth-Transport: cookie`). On a
page load `lib/session.tsx` refreshes first: a valid cookie brings the session
back, none means signed out. Refreshes are serialised across tabs (Web Locks).

**Fresh data.** `lib/useFetch.ts` loads a page's data; mutations in `lib/` emit
change signals (`useShiftsChanged`, `useJobsChanged`, `useTimesheetChanged`) and
lists refetch quietly. Coming back to the tab or the page also refreshes.

**Panels.** Forms and details open over the page (`openSheet({ kind: … })` from
`lib/sheets.ts`; `SheetHost` draws them). With a pointer it is a window in the
middle of the page: title and close on top, Cancel · Save bottom right, Delete
bottom left (`footerStart`). On a phone it rises from the bottom.

**Who gets in.** Three checks, weakest first: `src/proxy.ts` redirects before a
page renders (it reads the `sb_signed_in` hint cookie that `lib/storage.ts`
sets — a hint, not a credential); `AppShell` needs a real session (a token
refresh); the backend verifies the token on every data route.

**Home** is one column so the calendar gets the full width. On top: your next shift,
and beside it "Today" (who is working, person by person) when someone shares with
you — from 768px only; a phone leaves it to the day strip (a dot per person) and "Coming up". Then anything that needs a look, the calendar, and under it what can wait
(Coming up, the totals, copy-week).

**Home's calendar** (`features/home/ScheduleBoard.tsx`) is a week or a month grid (the
Week / Month switch) and also carries the schedules other people share with you.
Each person has one colour of their own. In the week view every person gets a row,
so whose shift is whose is answered by where it sits; in the month view someone
else's shift carries their initial. A shift is a solid block of its job's colour.
An empty future day of yours is one big "add a shift" button; a day that has shifts keeps a small + under them. The name chips above hide or show a person. Both choices are per-browser
preferences (`lib/preferences.ts`: `homeView`, `sharedOnHome`); Settings → Home page
turns the shared schedules off; the same switch is on Sharing, under "Shared with you".

**The assistant** (`features/assistant/`, Ctrl/⌘ J, the sidebar's Assistant, the mic button
above the tabs on a phone). The browser turns speech into text (Web Speech API: Chrome, Edge,
Safari; Firefox can only type) and reads replies aloud; `POST /assistant/messages` does the
rest with Gemini. Anything that saves comes back as a card and waits for a yes — spoken
("haan, add kardo") or the card's button (`POST /assistant/confirm`). The conversation is kept
in memory in `Assistant.tsx` and sent with each turn. While a shift's panel is open the assistant
lives inside that `<dialog>` (a modal dialog makes everything outside it inert) and shrinks to a
pill at the top. Listening pauses while it thinks and speaks, so it never hears itself.

**Designed for the web, not a stretched phone app.** The sidebar, Ctrl/⌘ K search
(`CommandPalette`), tables (Shifts, Timesheet), the week board on Home and the
month grid with shift names all exist only from 768px up; below that the same
data is drawn as the phone layouts (day strip, stacked rows, tab bar). Type sizes
carry their own tracking and leading (`@theme` in `globals.css`); controls are
32px with a pointer and 40px on touch.

## Rules that are easy to break

- No business rule here. If the web needs one, it goes in the backend's
  `src/domain/` with a test, and the mobile app gets it too.
- Outcomes are toasts (`lib/notify.ts`); questions are dialogs (`showAlert` in
  `lib/dialog.ts`). Never `confirm()` / `alert()`.
- **A toast can't be seen or clicked while a sheet is open** (a sheet is a modal
  `<dialog>`). Inside a sheet show errors inline with `FormError`; toast only as it closes.
- **Next.js keeps a page alive after you navigate away** (`cacheComponents`). State
  is not reset: clear passwords and "busy" flags when a form succeeds, and never
  assume a page starts fresh.
- Jobs are named by workplace: `jobName()` / `jobRole()` from `lib/jobLabels.ts`.
- On an edit, send `null` to clear an optional field, never `undefined`.
- The design decisions (colour, type, spacing, controls, motion) are written down in
  `.interface-design/system.md`. Text colours are held to 4.5:1 on the page colour: words use
  `muted-foreground` (never `faint`), amber and red words use `warning-ink` / `destructive-ink`.
- Every "Log out" calls `useLogOut()` (`lib/session.tsx`) — one question, asked once. Never call `signOut` straight from a button.
- Colours come from the theme tokens in `src/app/globals.css` (shadcn/ui names).
  Each theme is a `[data-theme]` block with a dark side (`[data-theme][data-mode="dark"]`); the
  family is the mobile app's. The choice is theme + mode (Auto / Light / Dark, `lib/themes.ts`);
  `components/theme/useTheme.ts` is the only writer. A new theme needs both blocks.
  Picking a theme or mode only previews it (the page shows it, storage doesn't) until Save;
  Cancel or leaving Settings puts the saved look back. "My theme" (`data-theme="custom"`) is
  four colours a side (`lib/customTheme.ts`), saved as `--c-*` variables that the boot script
  puts on <html>; the rest of its palette is mixed in `globals.css`.
- Every screen shape is checked by `e2e/layout.mjs` (18 sizes, phone to ultrawide: no sideways
  scroll, nothing cut off, panels fit). A grid of cards is `grid-cols-1` on a phone, never a bare
  `grid` — an implicit column grows to its widest child. Add a new page or panel to that file.
- `e2e/phone.mjs` opens every page, every panel and both pickers as a touch phone (320, 375, 430,
  and 667 on its side) and also fails anything pressable smaller than 24×24 px. A new panel goes there too.
  On a phone a period label drops its "This week ·" (`PeriodNav` `context`), and a picker stays open
  when only the height changes — the keyboard opening, the toolbar sliding away.
- The Route panel (`features/commute/RouteSheet.tsx`) follows the phone's route screen: trips
  start closed, pressing one puts it on the map and opens its steps, pressing again closes them.
- Motion: press feedback is a 100–150 ms scale; a panel materialises in 220 ms and
  leaves in 150 ms (a phone sheet slides 380 / 220 ms); changing page or section and
  the Ctrl K search never animate. Hover styles use `pointer-fine:` so touch never
  sticks in a hover state. Reduced motion and reduced transparency are respected.
- A list that is its own surface uses `surface` + hairline dividers (`ShiftList`),
  never a stack of separate cards.
- Dates and times are never the browser's own `<input type="date|time">` (they follow the
  browser's language: 24-hour, dd-mm-yyyy). Use `DatePicker` / `TimePicker` from
  `components/ui` — "Thu, Oct 8" and "5:30 PM" everywhere, in the device's time zone.
  The month grid is `react-day-picker`; the time list is ours. Both float in `Popover`
  (the browser's popover, so it sits above an open dialog) on the `glass` material.
- The assistant only asks the backend and acts on its answer (`actions`: open a page, a shift,
  a panel). It never saves anything itself: a card's Save and a spoken yes both go through the
  backend. A new page or panel it should open: add it to `ASSISTANT_PAGES` / `ASSISTANT_PANELS`
  in the backend and to `runAction` in `Assistant.tsx`.
- A panel's main button is the `action` prop (it lands in the footer), not a button
  in the content. Disable it until the data it needs has loaded.

## Checks

```bash
npm run typecheck
npm run lint            # 0 problems
npm run build
```

Browser walk-throughs (need the backend running and the built site on port 3210):

```bash
npm run build && npx next start -p 3210
npm run test:e2e        # in another terminal
```

`e2e/assistant.mjs` stands in for the speech service and scripts Gemini's answers (so it
doesn't use up the free quota); `AI_LIVE=1 node e2e/assistant.mjs` talks to the real Gemini.

They create `@test.local` accounts and delete them afterwards. The backend allows
20 sign-in attempts per 15 minutes per address, and the suites together sign in
more than that from one machine: run the backend with `RATE_LIMIT_SCALE=10` in its
`.env` (ignored in production), or the last suite starts logged out with a 429.

## Not built yet

- Apple sign-in (needs an Apple Services ID), and Google sign-in is untested until a web client id exists.
- Custom accent colour, the landing page, error reporting, CI and deployment.
- `packages/contracts`: `lib/` and `interfaces/` are copies of the mobile app's files for now.
