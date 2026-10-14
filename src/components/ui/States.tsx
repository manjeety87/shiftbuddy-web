import { CloudOff } from "lucide-react";
import { Button } from "./Button";

/** A load failed: say so and offer the way out. Never a bare error line. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section role="alert" className="surface flex flex-col items-center px-6 py-10 text-center">
      <span aria-hidden className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        <CloudOff className="size-5" />
      </span>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">{message}</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        Try Again
      </Button>
    </section>
  );
}

/** Placeholder rows while a list loads — the page keeps its shape, nothing jumps when data lands. */
export function SkeletonRows({ rows = 3, className = "h-14" }: { rows?: number; className?: string }) {
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`animate-pulse rounded-xl bg-muted/50 ${className}`} />
      ))}
    </div>
  );
}
