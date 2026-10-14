// Shared by the layout walk-throughs (layout.mjs, phone.mjs): runs inside the page and
// lists what makes a screen feel broken — sideways scroll, things off the edge or cut off,
// a panel that does not fit or whose buttons are out of reach.

/** Runs in the page: what is wrong with the layout as it stands now. */
export const inspect = () => {
  const found = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  const name = (el) => `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}" .${String(el.className?.baseVal ?? el.className).slice(0, 60)}`;
  const clips = (el, axis) => ["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(el)[axis]);
  const hasClippingParent = (el, axis) => {
    for (let parent = el.parentElement; parent; parent = parent.parentElement) if (clips(parent, axis)) return true;
    return false;
  };

  const root = document.documentElement;
  if (root.scrollWidth > width + 1) found.push(`the page scrolls sideways (${root.scrollWidth}px wide in a ${width}px window)`);

  const scope = document.querySelector("dialog[open]") ?? document.body;
  for (const el of scope.querySelectorAll("*")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || el.closest("[aria-hidden=true], .sr-only, .leaflet-container")) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    if ((box.right > width + 1 || box.left < -1) && !hasClippingParent(el, "overflowX")) found.push(`hangs off the side (${Math.round(box.left)}…${Math.round(box.right)}): ${name(el)}`);

    if (el.matches("input, textarea, select")) continue; // a long typed value scrolls inside its field
    const cutsX = ["hidden", "clip"].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const meantToTruncate = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
    if (cutsX && !meantToTruncate && el.clientWidth > 0) found.push(`cut off sideways (${el.scrollWidth}px in ${el.clientWidth}px): ${name(el)}`);
    const cutsY = ["hidden", "clip"].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 4;
    if (cutsY && !meantToTruncate && el.clientHeight > 0) found.push(`cut off at the bottom (${el.scrollHeight}px in ${el.clientHeight}px): ${name(el)}`);
  }

  const dialog = document.querySelector("dialog[open]");
  if (dialog) {
    const box = dialog.getBoundingClientRect();
    if (box.top < -1 || box.bottom > height + 1 || box.left < -1 || box.right > width + 1) found.push(`the panel does not fit the window (${Math.round(box.left)},${Math.round(box.top)} → ${Math.round(box.right)},${Math.round(box.bottom)} in ${width}×${height})`);
    for (const button of dialog.querySelectorAll("footer button, header button")) {
      const b = button.getBoundingClientRect();
      if (b.width && (b.bottom > height + 1 || b.top < -1)) found.push(`a panel button is out of reach: ${name(button)}`);
    }
  }
  return [...new Set(found)].slice(0, 8);
};
