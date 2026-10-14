import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

// 16px on a phone (anything smaller makes iOS zoom the page on focus), the UI size with a pointer
export const inputClass =
  "h-10 w-full rounded-lg bg-card px-3 text-[16px] text-foreground shadow-[0_0_0_1px_var(--line-strong),0_1px_1px_rgb(0_0_0/0.03)] transition-shadow duration-150 placeholder:text-muted-foreground focus:shadow-[0_0_0_2px_var(--primary),0_0_0_5px_color-mix(in_oklab,var(--primary)_18%,transparent)] focus:outline-none disabled:opacity-60 aria-invalid:shadow-[0_0_0_1.5px_var(--destructive)] md:h-8 md:px-2.5 md:text-sm";

/** A native select in the same clothes as an input, with the arrow drawn by us (`select-arrow` in globals.css). */
export const selectClass = `${inputClass} select-arrow`;

interface Labelled {
  label: string;
  /** Shown under the field in the error colour */
  error?: string | null;
  hint?: ReactNode;
}

/** What ties a field to its error or hint for a screen reader. */
const describe = (id: string, error?: string | null, hint?: ReactNode) => ({ "aria-invalid": error ? (true as const) : undefined, "aria-describedby": error || hint ? `${id}-note` : undefined });

function Shell({ id, label, error, hint, children }: Labelled & { id: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-note`} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-note`} className="mt-1.5 text-xs text-pretty text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ label, error, hint, className = "", ...rest }: Labelled & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <input id={id} {...describe(id, error, hint)} className={`${inputClass} ${className}`} {...rest} />
    </Shell>
  );
}

export function TextArea({ label, error, hint, className = "", ...rest }: Labelled & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <textarea id={id} rows={3} {...describe(id, error, hint)} className={`${inputClass} h-auto resize-none py-2 md:h-auto ${className}`} {...rest} />
    </Shell>
  );
}

export function SelectField({ label, error, hint, className = "", children, ...rest }: Labelled & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <select id={id} {...describe(id, error, hint)} className={`${selectClass} ${className}`} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

/** A problem with the whole form (wrong password, the server said no) — inline, never a dialog. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-pretty text-destructive-ink transition-opacity [&_a]:underline duration-200 ease-out starting:opacity-0">
      {children}
    </div>
  );
}

/** The heading of a group on a page or in a panel. */
export function SectionLabel({ children, id, className = "mb-2.5" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`text-sm font-semibold text-foreground ${className}`}>
      {children}
    </h2>
  );
}
