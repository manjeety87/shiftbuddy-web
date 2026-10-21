"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import type { PendingDeletion } from "@/interfaces/account.d";
import { pendingDeletionOf, restoreAccount } from "@/lib/account";
import { errorCode, errorMessage } from "@/lib/api";
import { loginUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { useSession } from "@/lib/session";
import { AuthHeading, authLink, useAuthEmail } from "./AuthFrame";
import { clearDeletionNotice, longDate, useDeletionNotice } from "./deletionNotice";
import { GoogleButton } from "./GoogleButton";

export function LoginForm() {
  const { signIn } = useSession();
  const { email, setEmail } = useAuthEmail();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingDeletion | null>(null);
  const deletionNotice = useDeletionNotice();

  const welcomeBack = (user: Parameters<typeof signIn>[0]) => {
    clearDeletionNotice();
    signIn(user); // the frame sends a signed-in visitor to the app
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await loginUser(email, password);
      // Next.js keeps this page alive after leaving it: don't leave credentials in it
      setPassword("");
      setEmail("");
      welcomeBack(user);
    } catch (failure) {
      const code = errorCode(failure);
      const waiting = pendingDeletionOf(failure);
      if (waiting) {
        // Proved it's theirs: the next step is a choice, not an error
        setPassword("");
        setPending(waiting);
        return;
      }
      // The answer to "no such account" is the way to make one, not a dead end
      if (code === "NO_ACCOUNT") {
        setError(
          <>
            No account uses <strong className="font-semibold wrap-anywhere">{email.trim()}</strong>.{" "}
            <Link href="/register" className={authLink}>
              Create an account
            </Link>{" "}
            with it, or check the spelling.
          </>,
        );
      } else if (code === "WRONG_PASSWORD") {
        setError(
          <>
            That password isn’t right.{" "}
            <Link href="/forgot-password" className={authLink}>
              Reset it
            </Link>{" "}
            if you’ve forgotten it.
          </>,
        );
      } else {
        setError(errorMessage(failure, "Couldn’t log you in. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  if (pending) return (
      <RestoreAccount
        pending={pending}
        onRestored={welcomeBack}
        onCancel={(reason) => {
          setPending(null);
          setError(reason ?? null);
        }}
      />
    );

  return (
    <>
      <AuthHeading title="Welcome back">Log in to see your week.</AuthHeading>
      {deletionNotice && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-xl bg-card p-3.5 text-sm shadow-card">
          <p className="min-w-0 flex-1 text-pretty">
            <span className="font-medium">Your account will be deleted on {longDate(deletionNotice)}.</span>{" "}
            <span className="text-muted-foreground">Changed your mind? Log in before then and you can restore it.</span>
          </p>
          <button type="button" aria-label="Dismiss" onClick={clearDeletionNotice} className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-hover">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <FormError>{error}</FormError>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" spellCheck={false} autoCapitalize="none" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            <Link href="/forgot-password" className="pointer-fine:hover:text-foreground pointer-fine:hover:underline">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" className="mt-1 w-full md:h-9" busy={busy} disabled={!email.trim() || !password}>
          Log In
        </Button>
      </form>
      <GoogleButton onSignedIn={welcomeBack} onError={setError} onPendingDeletion={setPending} />
      <p className="mt-7 text-sm text-muted-foreground">
        New to ShiftBuddy?{" "}
        <Link href="/register" className={authLink}>
          Create an account
        </Link>
      </p>
    </>
  );
}

/**
 * Signed in to an account that is waiting to be deleted. Bringing it back is
 * their decision, so it is a clear choice on its own screen, not a side effect of
 * logging in.
 */
function RestoreAccount({ pending, onRestored, onCancel }: { pending: PendingDeletion; onRestored: Parameters<typeof GoogleButton>[0]["onSignedIn"]; onCancel: (reason?: string) => void }) {
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await restoreAccount(pending.restoreToken);
      notify.success("Welcome back! Your account is restored.");
      onRestored(user);
    } catch (failure) {
      setBusy(false);
      // The offer only lasts a few minutes: past that, logging in again makes a new one
      if (errorCode(failure) === "RESTORE_EXPIRED") return onCancel("That took a while, so the offer timed out. Log in again to restore your account.");
      setError(errorMessage(failure, "Couldn’t restore your account. Please try again."));
    }
  };

  return (
    <>
      <AuthHeading title="Restore your account?">
        {pending.email ? <strong className="font-semibold wrap-anywhere">{pending.email}</strong> : "This account"} is set to be deleted on {longDate(pending.purgeAt)}.
      </AuthHeading>
      <FormError>{error}</FormError>
      <p className="mb-6 text-sm text-pretty text-muted-foreground">Restore it and everything comes back — your jobs, shifts and hours, just as you left them. People you shared with will see your schedule again.</p>
      <Button className="w-full md:h-9" busy={busy} onClick={restore}>
        Restore Account
      </Button>
      <Button variant="quiet" className="mt-2 w-full md:h-9" disabled={busy} onClick={() => onCancel()}>
        Not Now
      </Button>
    </>
  );
}
