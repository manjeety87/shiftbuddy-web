import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";

const VARIANTS: Record<Variant, string> = {
  // The top highlight is light catching the edge: it makes the one filled button read as raised
  primary: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.14)] pointer-fine:hover:bg-primary-hover",
  secondary: "bg-card text-foreground shadow-card pointer-fine:hover:bg-raised pointer-fine:hover:shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_rgb(0_0_0/0.06)]",
  ghost: "text-primary pointer-fine:hover:bg-hover",
  quiet: "text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground",
  danger: "text-destructive pointer-fine:hover:bg-destructive/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  /** Shows a spinner and blocks a second click while the action runs */
  busy?: boolean;
  icon?: ReactNode;
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent [animation-duration:600ms] ${className}`} />;
}

/** A key hint next to a label ("New shift  N"). Only where there is a keyboard to press it on. */
export function Kbd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <kbd className={`hidden rounded-[5px] px-1.5 py-px font-sans text-2xs font-medium text-muted-foreground shadow-[0_0_0_1px_var(--line)] pointer-fine:inline-block ${className}`}>{children}</kbd>;
}

/**
 * The press answers on pointer-down (scale), before the click lands. Thumb-sized
 * on a phone, tighter with a pointer: a desktop control doesn't need a thumb's room.
 */
export function Button({ variant = "primary", size = "md", busy = false, icon, children, className = "", disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[scale,background-color,box-shadow,opacity] duration-150 ease-out select-none active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-45 ${
        size === "sm" ? "h-8 px-2.5 text-sm md:h-7" : "h-10 px-4 text-sm md:h-8 md:px-3"
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy ? <Spinner className="size-3.5" /> : icon}
      {children}
    </button>
  );
}
