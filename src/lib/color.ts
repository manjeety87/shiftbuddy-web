// Colour helpers — derived theme values (text on primary, light/dark) are
// computed, not hand-picked, so they stay correct for custom themes too.

const parseHex = (hex: string): [number, number, number] => {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** WCAG relative luminance, 0 (black) → 1 (white). */
export const luminance = (hex: string): number => {
    const [r, g, b] = parseHex(hex).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
};

/** White or near-black — whichever reads better on `background`. */
export const readableTextOn = (background: string): string =>
    contrast('#FFFFFF', background) >= contrast('#111111', background) ? '#FFFFFF' : '#111111';

export const isDarkColor = (hex: string): boolean => luminance(hex) < 0.18;

/** `#RRGGBB` + alpha (0–1) → `rgba(...)`. */
export const withAlpha = (hex: string, alpha: number): string => {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
};
