"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { errorCode, errorMessage } from "@/lib/api";
import { forgotPassword, resetPassword } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { AuthHeading, authLink, useAuthEmail } from "./AuthFrame";
import { isStrongPassword, PasswordRules } from "./password";

/** Two steps on one page: ask for the email, then enter the emailed code with a new password. */
export function ResetPasswordFlow() {
  const router = useRouter();
  const { email, setEmail } = useAuthEmail();
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  const run = async (event: FormEvent, work: () => Promise<void>, fallback: string) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      // The code step is only reached for a real account: an unknown email is told so here, with the way forward
      setError(
        errorCode(failure) === "NO_ACCOUNT" ? (
          <>
            No account uses <strong className="font-semibold wrap-anywhere">{email.trim()}</strong>, so there’s no password to reset.{" "}
            <Link href="/register" className={authLink}>
              Create an account
            </Link>{" "}
            or check the spelling.
          </>
        ) : (
          errorMessage(failure, fallback)
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (event: FormEvent) =>
    run(
      event,
      async () => {
        await forgotPassword(email.trim().toLowerCase());
        setStep("code");
      },
      "Couldn’t send the code. Please try again.",
    );

  const saveNewPassword = (event: FormEvent) =>
    run(
      event,
      async () => {
        await resetPassword(email.trim().toLowerCase(), code, password);
        notify.success("Password changed", { description: "Log in with your new password." });
        // Next.js keeps this page alive after leaving it: start clean next time
        setStep("email");
        setCode("");
        setPassword("");
        router.replace("/login");
      },
      "That code didn’t work. Check it and try again.",
    );

  return step === "email" ? (
    <>
      <AuthHeading title="Reset your password">Enter your account’s email and we’ll send a 6-digit code.</AuthHeading>
      <form onSubmit={sendCode} noValidate>
        <FormError>{error}</FormError>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" spellCheck={false} autoCapitalize="none" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" className="mt-1 w-full md:h-9" busy={busy} disabled={!email.trim()}>
          Send Code
        </Button>
      </form>
      <p className="mt-7 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className={authLink}>
          Back to log in
        </Link>
      </p>
    </>
  ) : (
    <>
      <AuthHeading title="Check your email">
        We sent a code to <span className="font-medium wrap-anywhere text-foreground">{email.trim()}</span>. It works for 10 minutes.
      </AuthHeading>
      <form onSubmit={saveNewPassword} noValidate>
        <FormError>{error}</FormError>
        <TextField
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="tracking-[0.3em] tabular-nums"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
        <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <PasswordRules value={password} />
        <Button type="submit" className="w-full md:h-9" busy={busy} disabled={code.length !== 6 || !isStrongPassword(password)}>
          Change Password
        </Button>
      </form>
      <p className="mt-7 text-sm">
        <button
          type="button"
          className="text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:underline"
          onClick={() => {
            setError(null);
            setCode("");
            setStep("email");
          }}
        >
          Use a different email
        </button>
      </p>
    </>
  );
}
