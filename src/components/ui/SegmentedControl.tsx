"use client";

import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * The only segmented control. Real radio inputs underneath, so arrow keys and
 * screen readers work for free; the thumb slides because it is one object moving
 * between places (200ms, ease-in-out), not two states swapping.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className = "" }: { options: readonly Option<T>[]; value: T; onChange: (value: T) => void; label: string; className?: string }) {
  const name = useId();
  const index = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div role="radiogroup" aria-label={label} className={`relative grid rounded-[9px] bg-pressed p-0.5 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-[7px] bg-raised shadow-[0_0_0_0.5px_var(--line),0_1px_3px_rgb(0_0_0/0.12)] transition-transform duration-200 ease-in-out"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <label
          key={option.value}
          className={`relative flex h-9 cursor-pointer items-center justify-center rounded-[7px] px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary md:h-7 ${
            option.value === value ? "text-foreground" : "text-muted-foreground pointer-fine:hover:text-foreground"
          }`}
        >
          <input type="radio" name={name} className="sr-only" checked={option.value === value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}
