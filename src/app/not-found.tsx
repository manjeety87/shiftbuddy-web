import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/** An address that leads nowhere: say so, and give the way back. Only a signed-in visitor gets this far — the route guard sends everyone else to log in. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center px-6 py-10">
      <span aria-hidden className="mb-6 flex size-9 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
        S
      </span>
      <p className="text-sm font-semibold text-primary tabular-nums">404</p>
      <h1 className="mt-1 text-3xl font-bold text-balance">This page doesn’t exist</h1>
      <p className="mt-2 text-base text-pretty text-muted-foreground">The link may be old, or the address has a typo. Your shifts are where you left them.</p>
      <Link
        href="/home"
        className="mt-7 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.14)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.97] md:h-8 md:px-3 pointer-fine:hover:bg-primary-hover"
      >
        Back to Home
      </Link>
    </main>
  );
}
