"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

const GAP = 6;
const EDGE = 8;

/** Under the trigger, or above it when there is no room below; never off the screen. Grows from the trigger's corner. */
const place = (panel: HTMLElement, anchor: HTMLElement) => {
  const from = anchor.getBoundingClientRect();
  const { width, height } = panel.getBoundingClientRect();
  const fitsBelow = from.bottom + GAP + height <= window.innerHeight - EDGE;
  const goesAbove = !fitsBelow && from.top - GAP - height >= EDGE;
  const left = Math.max(EDGE, Math.min(from.left, window.innerWidth - width - EDGE));
  panel.style.left = `${left}px`;
  panel.style.top = `${goesAbove ? from.top - GAP - height : Math.min(from.bottom + GAP, Math.max(EDGE, window.innerHeight - height - EDGE))}px`;
  panel.style.transformOrigin = `${Math.round(from.left - left + 16)}px ${goesAbove ? "100%" : "0"}`;
};

/**
 * A small floating panel anchored to the control that opened it (a calendar, a
 * list of times). It uses the browser's own popover: it sits above everything,
 * including an open dialog, closes on Esc or a click outside, and hands focus
 * back. The surface is glass — a lighter material than the panel under it — and
 * it grows out of its trigger, so where it came from is never in doubt.
 */
interface PopoverProps {
  /** Names the floating panel */
  label: string;
  /** The button that opens it: its id (for a <label>), its own accessible name when there is no label, its look and its content */
  buttonId?: string;
  buttonLabel?: string;
  buttonClassName?: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
}

export function Popover({ label, buttonId, buttonLabel, buttonClassName, button, children }: PopoverProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // A press on the trigger while open already closes it (it is a click outside); the click that follows must not reopen it
  const wasOpenOnPress = useRef(false);

  // Found by id, not through the ref: this is handed to the content while rendering
  const close = () => document.getElementById(id)?.hidePopover();

  const show = (event: MouseEvent<HTMLElement>) => {
    const element = panel.current;
    const justClosed = wasOpenOnPress.current;
    wasOpenOnPress.current = false; // a key press has no pointer-down to reset it
    if (!element || justClosed) return;
    // Shown, filled and placed in one go — before the browser paints, so it never appears empty or in the wrong spot
    element.showPopover();
    flushSync(() => setOpen(true));
    place(element, event.currentTarget);
  };

  // It is pinned to the screen; if what it is anchored to scrolls away or the window changes, it has to go
  useEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    const onScroll = (event: Event) => {
      if (!element.contains(event.target as Node)) element.hidePopover();
    };
    // A phone resizes the window when its keyboard opens (the time list has a field) or its toolbar
    // slides away; that leaves the anchor where it was. Only a new width moves it.
    const openWidth = window.innerWidth;
    const onResize = () => window.innerWidth !== openWidth && element.hidePopover();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        id={buttonId}
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        className={buttonClassName}
        onPointerDown={() => {
          wasOpenOnPress.current = open;
        }}
        onClick={show}
      >
        {button}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        onToggle={(event) => {
          if (event.newState === "closed") setOpen(false);
        }}
        className="glass"
      >
        {open && children(close)}
      </div>
    </>
  );
}
