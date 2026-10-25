"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const ROW = 40;
const SIDE_ROWS = 2; // rows above and below the middle one
const SETTLE_MS = 120;

/**
 * One column of an iOS-style wheel — the phone app's WheelPicker for the web. It
 * scrolls and snaps row by row, rows curve away like a drum, a click on a row
 * moves it to the middle, and the arrow keys step it. Reports the settled value.
 */
export function WheelPicker({ values, value, onChange, label, format = String }: { values: number[]; value: number; onChange: (value: number) => void; label: string; format?: (value: number) => string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const index = Math.max(0, values.indexOf(value));
  // The row in the middle while scrolling; only drawn, reported once the wheel settles
  const [centre, setCentre] = useState(index);

  useEffect(() => {
    // Next frame: inside a panel the wheel mounts before the <dialog> opens, and a
    // hidden element can't be scrolled. Only where it starts — after that the wheel leads.
    const frame = requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = index * ROW;
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A click glides the row to the middle; a key steps at once (keys repeat fast, and
  // each step counts from where the wheel is, not from where a glide is heading)
  const goTo = (next: number, glide: boolean) => {
    const clamped = Math.min(values.length - 1, Math.max(0, next));
    const smooth = glide && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.current?.scrollTo({ top: clamped * ROW, behavior: smooth ? "smooth" : "auto" });
  };

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const row = Math.min(values.length - 1, Math.max(0, Math.round(element.scrollTop / ROW)));
    setCentre(row);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (values[row] !== value) onChange(values[row]);
    }, SETTLE_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
    const current = Math.round((scroller.current?.scrollTop ?? 0) / ROW);
    if (event.key in steps) goTo(current + steps[event.key], false);
    else if (event.key === "Home") goTo(0, false);
    else if (event.key === "End") goTo(values.length - 1, false);
    else return;
    event.preventDefault();
  };

  return (
    <div className="relative" style={{ height: ROW * (SIDE_ROWS * 2 + 1) }}>
      {/* The band behind the middle row */}
      <div aria-hidden className="pointer-events-none absolute inset-x-1 rounded-lg bg-pressed" style={{ top: ROW * SIDE_ROWS, height: ROW }} />
      <div
        ref={scroller}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={values[centre]}
        aria-valuetext={format(values[centre])}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-lg [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-scrollbar]:hidden"
        style={{ paddingBlock: ROW * SIDE_ROWS, maskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)" }}
      >
        {values.map((option, row) => {
          const distance = Math.min(3, Math.abs(row - centre));
          return (
            <button
              key={option}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => goTo(row, true)}
              className="flex w-full snap-center items-center justify-center text-xl tabular-nums"
              style={{ height: ROW, opacity: [1, 0.55, 0.3, 0.15][distance], transform: `perspective(600px) rotateX(${(row - centre) * -18}deg) scale(${1 - distance * 0.05})` }}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
