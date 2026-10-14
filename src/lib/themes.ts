// Theme names only. The colours themselves live in `app/globals.css`: one block per
// `[data-theme]` for its light side and one per `[data-theme][data-mode="dark"]` —
// the same family as the mobile app's `constants/themes.ts`.

export const THEMES = [
  { name: "sunsamaFocus", label: "Sunsama Focus", note: "Sage green on warm paper" },
  { name: "clayStudio", label: "Clay Studio", note: "Terracotta on cream" },
  { name: "harborMist", label: "Harbor Mist", note: "Dusty blue on soft stone" },
  { name: "lavenderDusk", label: "Lavender Dusk", note: "Muted plum on warm grey" },
] as const;

/** "system" follows the device: light by day, dark when the device goes dark. */
export const MODES = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export type ThemeName = (typeof THEMES)[number]["name"];
export type ThemeMode = (typeof MODES)[number]["value"];
/** What is on the page once "system" has been answered */
export type ResolvedMode = "light" | "dark";

export const DEFAULT_THEME: ThemeName = "sunsamaFocus";
export const DEFAULT_MODE: ThemeMode = "system";
export const THEME_STORAGE_KEY = "shiftbuddy.theme";
export const MODE_STORAGE_KEY = "shiftbuddy.mode";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Evening Focus was the only dark theme before every theme had a dark side; it is Sunsama Focus after dark. */
export const LEGACY_DARK_THEME = "eveningFocus";

export const isThemeName = (value: unknown): value is ThemeName => THEMES.some((theme) => theme.name === value);
export const isThemeMode = (value: unknown): value is ThemeMode => MODES.some((mode) => mode.value === value);

/**
 * Runs in <head> before the first paint, so a saved theme never flashes the
 * default one first. Only known names are applied: the values come from storage.
 * `components/theme/useTheme.ts` reads the same two keys the same way.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),m=localStorage.getItem(${JSON.stringify(
  MODE_STORAGE_KEY,
)});if(t===${JSON.stringify(LEGACY_DARK_THEME)}){t=${JSON.stringify(DEFAULT_THEME)};m=m||"dark"}if(${JSON.stringify(THEMES.map((theme) => theme.name))}.indexOf(t)>-1)d.setAttribute("data-theme",t);if(m!=="light"&&m!=="dark")m=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light";d.setAttribute("data-mode",m)}catch(e){}})()`;
