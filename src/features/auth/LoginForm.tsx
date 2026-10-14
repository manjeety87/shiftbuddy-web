"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { errorCode, errorMessage } from "@/lib/api";
import { loginUser } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { AuthHeading, authLink, useAuthEmail } from "./AuthFrame";
import { GoogleButton } from "./GoogleButton";

export function LoginForm() {
  const { signIn } = useSession();
  const { email, setEmail } = useAuthEmail();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await loginUser(email, password);
      // Next.js keeps this page alive after leaving it: don't leave credentials in it
      setPassword("");
      setEmail("");
      signIn(user); // the frame sends a signed-in visitor to the app
    } catch (failure) {
      const code = errorCode(failure);
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

  return (
    <>
      <AuthHeading title="Welcome back">Log in to see your week.</AuthHeading>
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
      <GoogleButton onSignedIn={signIn} onError={setError} />
      <p className="mt-7 text-sm text-muted-foreground">
        New to ShiftBuddy?{" "}
        <Link href="/register" className={authLink}>
          Create an account
        </Link>
      </p>
    </>
  );
}
