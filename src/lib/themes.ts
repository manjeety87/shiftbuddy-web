// Theme names only. The colours themselves live in `app/globals.css`: one block per
// `[data-theme]` for its light side and one per `[data-theme][data-mode="dark"]` —
// the same family as the mobile app's `constants/themes.ts`.

export const THEMES = [
  { name: "sunsamaFocus", label: "Sunsama Focus", note: "Sage green on warm paper", collection: "original" },
  { name: "clayStudio", label: "Clay Studio", note: "Terracotta on cream", collection: "original" },
  { name: "harborMist", label: "Harbor Mist", note: "Dusty blue on soft stone", collection: "original" },
  { name: "lavenderDusk", label: "Lavender Dusk", note: "Muted plum on warm grey", collection: "original" },
  { name: "cupertinoBlue", label: "Cupertino Blue", note: "System blue on cool grey", collection: "apple" },
  { name: "titaniumGraphite", label: "Titanium Graphite", note: "Graphite on light stone", collection: "apple" },
  { name: "sageAtelier", label: "Sage Atelier", note: "Botanical green on mist", collection: "apple" },
  { name: "pacificTeal", label: "Pacific Teal", note: "Deep teal on sea-glass white", collection: "apple" },
  { name: "midnightIndigo", label: "Midnight Indigo", note: "Rich indigo on soft lilac grey", collection: "apple" },
  { name: "champagneSand", label: "Champagne Sand", note: "Warm gold-brown on ivory", collection: "apple" },
  { name: "obsidianSilver", label: "Obsidian & Silver", note: "Near-black and silver", collection: "elegant" },
  { name: "deepForest", label: "Deep Forest", note: "Forest green on pale sage", collection: "elegant" },
  { name: "nocturnePlum", label: "Nocturne Plum", note: "Muted plum on blush white", collection: "elegant" },
  { name: "oxfordNavy", label: "Oxford Navy", note: "Navy on cool paper", collection: "elegant" },
  { name: "espressoBronze", label: "Espresso Bronze", note: "Bronze on warm linen", collection: "elegant" },
  { name: "slateIce", label: "Slate & Ice", note: "Slate teal on icy grey", collection: "elegant" },
] as const;

/** The picker's groups, in order. Settings shows the first one; the rest open from "All themes". */
export const COLLECTIONS = [
  { id: "original", label: "Original" },
  { id: "apple", label: "Apple-inspired" },
  { id: "elegant", label: "Elegant" },
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
