"use client";

/**
 * On or off, applied at once. The thumb slides because it is one object moving
 * (200ms, ease-in-out) and the press answers on pointer-down.
 */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`group relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out md:h-6 md:w-10 ${checked ? "bg-primary" : "bg-border-strong"}`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[translate,scale] duration-200 ease-in-out group-active:scale-90 md:size-5 ${checked ? "translate-x-5 md:translate-x-4" : ""}`}
      />
    </button>
  );
}
