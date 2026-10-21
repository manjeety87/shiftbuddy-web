"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import type { User } from "@/interfaces/user.d";
import { errorMessage } from "@/lib/api";
import type { PendingDeletion } from "@/interfaces/account.d";
import { pendingDeletionOf } from "@/lib/account";
import { googleLogin } from "@/lib/auth";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

/**
 * "Continue with Google" — Google's own button, which hands back an ID token for
 * the backend to check. Shows nothing until a web client id is configured.
 */
export function GoogleButton({ onSignedIn, onError, onPendingDeletion }: { onSignedIn: (user: User) => void; onError: (message: string) => void; onPendingDeletion?: (pending: PendingDeletion) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  if (!CLIENT_ID) return null;

  const render = () => {
    const google = (window as unknown as { google?: GoogleIdentity }).google;
    if (!google || !holder.current) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: ({ credential }) => {
        googleLogin(credential)
          .then(onSignedIn)
          .catch((error) => {
            const pending = pendingDeletionOf(error);
            if (pending && onPendingDeletion) return onPendingDeletion(pending);
            onError(errorMessage(error, "Google sign-in didn’t work. Please try again."));
          });
      },
    });
    google.accounts.id.renderButton(holder.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
    setReady(true);
  };

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
      <div className={ready ? "mt-5" : "hidden"}>
        <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <div ref={holder} className="flex justify-center" />
      </div>
    </>
  );
}
