"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { errorCode, errorMessage } from "@/lib/api";
import { registerUser } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { openSheet } from "@/lib/sheets";
import { AuthHeading, authLink, useAuthEmail } from "./AuthFrame";
import { GoogleButton } from "./GoogleButton";
import { isStrongPassword, PasswordRules } from "./password";

export function RegisterForm() {
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const { email, setEmail } = useAuthEmail();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await registerUser(name.trim(), email, password);
      // A code was emailed at sign-up; the app opens with the place to enter it
      openSheet({ kind: "verifyEmail" });
      // Next.js keeps this page alive after leaving it: don't leave the form filled in
      setName("");
      setEmail("");
      setPassword("");
      signIn(user);
    } catch (failure) {
      if (errorCode(failure) === "ACCOUNT_PENDING_DELETION") {
        setError(
          <>
            This email’s account is set to be deleted.{" "}
            <Link href="/login" className={authLink}>
              Log in
            </Link>{" "}
            to restore it — everything is still there.
          </>,
        );
      } else {
        setError(errorMessage(failure, "Couldn’t create the account. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading title="Create your account">Free. It takes about a minute.</AuthHeading>
      <form onSubmit={submit} noValidate>
        <FormError>{error}</FormError>
        <TextField label="Name" autoComplete="name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" spellCheck={false} autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <PasswordRules value={password} />
        <Button type="submit" className="w-full md:h-9" busy={busy} disabled={name.trim().length < 2 || !email.trim() || !isStrongPassword(password)}>
          Create Account
        </Button>
      </form>
      <GoogleButton onSignedIn={signIn} onError={setError} />
      <p className="mt-7 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className={authLink}>
          Log in
        </Link>
      </p>
    </>
  );
}
