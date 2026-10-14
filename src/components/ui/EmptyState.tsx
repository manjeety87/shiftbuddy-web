import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** What a page shows when it has nothing to list. Pass the way forward as `action`. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
      <span aria-hidden className="mb-4 flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-card">
        <Icon className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{children}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}
