"use client";

import { useEffect, useRef, type PointerEvent } from "react";

const LONG_PRESS_MS = 450;
// A finger that drifts further than this is scrolling, not holding
const LONG_PRESS_SLOP_PX = 10;

/**
 * Press and hold a row on a touch screen to start selecting with it, the same
 * gesture as the phone app's Shifts and Jobs lists. A mouse uses the Select
 * button instead. `consumeLongPress` swallows the click that follows the hold.
 */
export function useLongPress(onLongPress: (id: string) => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const bind = (id: string) => ({
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress(id);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > LONG_PRESS_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The browser's own long-press menu would cover the selection that just started
    onContextMenu: (event: { preventDefault: () => void }) => {
      if (fired.current) event.preventDefault();
    },
  });

  const consumeLongPress = () => {
    const was = fired.current;
    fired.current = false;
    return was;
  };

  return { bind, consumeLongPress };
}

/** Esc leaves selecting, unless a panel on top is what it should close. */
export function useEscapeToStop(active: boolean, stop: () => void) {
  const latest = useRef(stop);
  useEffect(() => {
    latest.current = stop;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
