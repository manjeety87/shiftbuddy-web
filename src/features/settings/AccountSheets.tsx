"use client";

import { useEffect, useRef, useState } from "react";
import { LocationField } from "@/components/LocationField";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import type { Place } from "@/interfaces/user.d";
import { errorMessage } from "@/lib/api";
import { changePassword, removeHomeLocation, sendVerificationCode, setHomeLocation, verifyEmail } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { useSession, useUser } from "@/lib/session";
import { isStrongPassword, PasswordRules } from "../auth/password";

const RESEND_SECONDS = 60;

/** Enter the 6-digit code emailed at sign-up. It submits itself on the sixth digit. */
export function VerifyEmailSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const user = useUser();
  const { setUser } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // seconds until another code can be asked for

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      setUser(await verifyEmail(value));
      notify.success("Email verified");
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "That code didn’t work. Check it and try again."));
      setCode("");
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setWait(RESEND_SECONDS);
    try {
      await sendVerificationCode();
    } catch (failure) {
      setWait(0);
      setError(errorMessage(failure, "Couldn’t send a new code. Please try again."));
    }
  };

  return (
    <Sheet ref={sheet} title="Verify Your Email" onClose={onClose} cancelOnly>
      <p className="mb-5 text-sm text-pretty text-muted-foreground">
        We emailed a 6-digit code to <span className="font-medium text-foreground">{user.email}</span>. It works for 10 minutes. Verifying lets people share their schedule with you.
      </p>
      <FormError>{error}</FormError>
      <TextField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        disabled={busy}
        className="h-14 text-center text-2xl tracking-[0.4em] tabular-nums"
        value={code}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          setCode(digits);
          if (digits.length === 6) submit(digits);
        }}
      />
      <Button variant="ghost" size="sm" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `New code sent — send another in ${wait}s` : "Send a new code"}
      </Button>
    </Sheet>
  );
}

/** Changing the password signs every device out, this one included — the sheet says so before it happens. */
export function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { signOut } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      notify.success("Password changed", { description: "Log in again with the new one." });
      await signOut();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t change the password."));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Change Password" onClose={onClose} isDirty={!!current || !!next} action={{ label: "Change", onClick: save, busy, disabled: !current || !isStrongPassword(next) }}>
      <FormError>{error}</FormError>
      <TextField label="Current password" type="password" autoComplete="current-password" autoFocus value={current} onChange={(event) => setCurrent(event.target.value)} />
      <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
      <PasswordRules value={next} />
      <p className="text-xs text-muted-foreground">You’ll be signed out everywhere and asked to log in again.</p>
    </Sheet>
  );
}

/** Where travel times start from. Only used for leave-by times, routes and weather. */
export function HomeAddressSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const user = useUser();
  const { setUser } = useSession();
  const [place, setPlace] = useState<Place | null>(user.homeLocation);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      setUser(place ? await setHomeLocation(place) : await removeHomeLocation());
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save your home address."));
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} title="Home Address" onClose={onClose} isDirty={JSON.stringify(place) !== JSON.stringify(user.homeLocation)} action={{ onClick: save, busy }}>
      <FormError>{error}</FormError>
      <LocationField label="Home" value={place} onChange={setPlace} />
      <p className="text-xs text-pretty text-muted-foreground">Used to work out when to leave for a shift. People you share your schedule with never see it.</p>
    </Sheet>
  );
}
