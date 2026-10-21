import { luminance, readableTextOn } from "./color";

// The person's own theme: four colours for each side, light and dark. The rest of
// the palette is mixed from them in `app/globals.css` ([data-theme="custom"]).
// What is saved is the finished set of CSS variables, so the boot script can put
// it on <html> before the first paint without knowing any of this.

export const CUSTOM_COLOURS = [
  { key: "page", label: "Page", hint: "Behind everything" },
  { key: "card", label: "Cards", hint: "Lists, panels, fields" },
  { key: "text", label: "Text", hint: "Words and icons" },
  { key: "accent", label: "Accent", hint: "Buttons, links, today" },
] as const;

export const CUSTOM_SIDES = [
  { value: "light", label: "Light side" },
  { value: "dark", label: "Dark side" },
] as const;

export type CustomColour = (typeof CUSTOM_COLOURS)[number]["key"];
export type CustomSide = (typeof CUSTOM_SIDES)[number]["value"];
export type CustomTheme = Record<CustomSide, Record<CustomColour, string>>;

export const CUSTOM_STORAGE_KEY = "shiftbuddy.customTheme";

const variable = (side: CustomSide, name: CustomColour | "on-accent") => `--c-${side}-${name}`;

/** Every variable the saved theme sets — the boot script checks for exactly these. */
export const CUSTOM_VARIABLES = CUSTOM_SIDES.flatMap(({ value }) => [...CUSTOM_COLOURS.map(({ key }) => variable(value, key)), variable(value, "on-accent")]);

const HEX = /^#[0-9a-f]{6}$/i;

/** "#abc", "abc", "AABBCC" → "#aabbcc"; anything else → null. */
export const normaliseHex = (input: string): string | null => {
  const value = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((c) => c + c).join("")}`;
  return /^[0-9a-f]{6}$/.test(value) ? `#${value}` : null;
};

/** The CSS variables for a theme, text-on-accent included (white or near-black, whichever reads). */
export const customThemeVariables = (theme: CustomTheme): Record<string, string> =>
  Object.fromEntries(
    CUSTOM_SIDES.flatMap(({ value: side }) => [
      ...CUSTOM_COLOURS.map(({ key }) => [variable(side, key), theme[side][key]]),
      [variable(side, "on-accent"), readableTextOn(theme[side].accent).toLowerCase()],
    ]),
  );

/** Saved variables → the theme, or null when anything is missing or not a colour (the value comes from storage). */
export const parseCustomTheme = (raw: string | null): CustomTheme | null => {
  if (!raw) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!saved || typeof saved !== "object") return null;
  const values = saved as Record<string, unknown>;
  if (!CUSTOM_VARIABLES.every((name) => typeof values[name] === "string" && HEX.test(values[name]))) return null;
  const side = (name: CustomSide) => Object.fromEntries(CUSTOM_COLOURS.map(({ key }) => [key, values[variable(name, key)]])) as Record<CustomColour, string>;
  return { light: side("light"), dark: side("dark") };
};

export const sameCustomTheme = (a: CustomTheme, b: CustomTheme) => CUSTOM_SIDES.every(({ value }) => CUSTOM_COLOURS.every(({ key }) => a[value][key] === b[value][key]));

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * What would be hard to read. Advice, not a block: it is their theme. Same bars
 * the built-in themes were checked against — 4.5:1 for words, 3:1 for the accent
 * as a shape (buttons, the chosen day) on the page.
 */
export const customThemeWarnings = (colours: Record<CustomColour, string>): string[] => {
  const warnings: string[] = [];
  if (contrast(colours.text, colours.page) < 4.5 || contrast(colours.text, colours.card) < 4.5) warnings.push("Text is hard to read on the page or the cards. Move it further from them.");
  if (contrast(colours.accent, colours.page) < 3) warnings.push("The accent fades into the page — buttons and the chosen day will be hard to spot.");
  if (contrast(colours.card, colours.page) < 1.04) warnings.push("Cards and page are the same colour, so cards only show by their thin edge.");
  return warnings;
};

/**
 * A built-in theme's colours, read from the stylesheet: a hidden element carries
 * its name, so `globals.css` stays the only place the colours are written.
 */
export const readThemeColours = (themeName: string): CustomTheme => {
  const probe = document.createElement("div");
  probe.dataset.theme = themeName;
  probe.hidden = true;
  document.body.append(probe);
  const read = (mode: CustomSide): Record<CustomColour, string> => {
    probe.dataset.mode = mode;
    const style = getComputedStyle(probe);
    const value = (name: string, fallback: string) => normaliseHex(style.getPropertyValue(name)) ?? fallback;
    return {
      page: value("--background", mode === "dark" ? "#1b1a17" : "#f4f1ea"),
      card: value("--card", mode === "dark" ? "#262420" : "#ffffff"),
      text: value("--foreground", mode === "dark" ? "#ede9df" : "#2b2a25"),
      accent: value("--primary", mode === "dark" ? "#8db393" : "#527558"),
    };
  };
  const theme = { light: read("light"), dark: read("dark") };
  probe.remove();
  return theme;
};
