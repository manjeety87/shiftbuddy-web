"use client";

import { LoadError } from "@/components/ui/States";

/**
 * A page broke while drawing. The sidebar and tab bar stay (this sits inside the
 * shell), so the rest of the app is still one click away; "Try Again" redraws
 * just this page.
 */
export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <LoadError message="Something went wrong showing this page. Your shifts are safe — try again, or open another page." onRetry={retry} />
    </div>
  );
}
