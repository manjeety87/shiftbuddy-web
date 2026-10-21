"use client";

import { Briefcase, CalendarDays, Clock, Download, LogOut, Users, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/States";
import { showDeletionNotice, longDate } from "@/features/auth/deletionNotice";
import { getAccountSummary, requestAccountDeletion } from "@/lib/account";
import { errorCode, errorMessage } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useLogOut, useSession, useUser } from "@/lib/session";
import { useFetch } from "@/lib/useFetch";
import { downloadMyData } from "./downloadMyData";

const DAY_MS = 24 * 60 * 60 * 1000;
// The server's figure arrives with the summary; this is only for the moment before it does
const FALLBACK_GRACE_DAYS = 30;
const CONFIRM_WORD = "DELETE";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Deleting the account, said plainly before it happens: what goes, what happens
 * when, and the two ways people often wanted instead (keep a copy, or just log
 * out). Their password — or the word DELETE for a Google account — is the last
 * step, so it can't happen by a stray click or from someone else's hands.
 */
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const user = useUser();
  const { signOut } = useSession();
  const logOut = useLogOut();
  const summary = useFetch(getAccountSummary);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // The day it would go if they confirm now — fixed when the panel opens
  const [openedAt] = useState(Date.now);

  const graceDays = summary.data?.graceDays ?? FALLBACK_GRACE_DAYS;
  const purgeDay = longDate(new Date(openedAt + graceDays * DAY_MS).toISOString());
  const usesPassword = user.hasPassword;
  const ready = usesPassword ? secret.length > 0 : secret.trim().toUpperCase() === CONFIRM_WORD;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadMyData();
      notify.success("Your data is downloading");
    } catch (failure) {
      notify.error("Couldn’t download your data", { description: errorMessage(failure) });
    } finally {
      setDownloading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { purgeAt } = await requestAccountDeletion(usesPassword ? { password: secret } : { confirm: CONFIRM_WORD });
      setSecret("");
      // The login page says when it goes and how to change your mind
      showDeletionNotice(purgeAt);
      await signOut();
    } catch (failure) {
      setError(errorCode(failure) === "WRONG_PASSWORD" ? "That password isn’t right." : errorMessage(failure, "Couldn’t delete your account. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Delete account" onClose={onClose} isDirty={secret.length > 0} cancelOnly>
      <p className="text-sm text-pretty text-muted-foreground">We’re sorry to see you go. Here’s exactly what happens, so there are no surprises.</p>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Deleted with your account</h3>
      {summary.isLoading ? (
        <SkeletonRows rows={2} className="h-9" />
      ) : summary.data ? (
        <ul className="grid grid-cols-2 gap-2">
          <Fact icon={Briefcase} text={count(summary.data.jobs, "job", "jobs")} />
          <Fact icon={CalendarDays} text={count(summary.data.shifts, "shift", "shifts")} />
          <Fact icon={Clock} text={count(summary.data.timeEntries, "hours entry", "hours entries")} />
          <Fact icon={Users} text={summary.data.shares ? `Sharing with ${count(summary.data.shares, "person", "people")}` : "No one sees your schedule"} />
        </ul>
      ) : (
        // The counts are a courtesy: without them the step still works
        <p className="text-sm text-muted-foreground">Your jobs, shifts, hours and sharing.</p>
      )}

      <h3 className="mt-6 mb-2 text-sm font-semibold">What happens</h3>
      <ol className="relative flex flex-col gap-3.5 border-l border-border pl-5">
        <Step when="Right away">You’re signed out everywhere and your account is hidden. People you share with stop seeing your shifts.</Step>
        <Step when={`Until ${purgeDay}`}>Changed your mind? Log in and choose Restore account — everything comes back as it was.</Step>
        <Step when={purgeDay} last>
          Your account and everything in it are erased for good. This part can’t be undone.
        </Step>
      </ol>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Alternative icon={Download} title="Keep a copy first" text="Download your data as a file." onClick={download} busy={downloading} />
        <Alternative icon={LogOut} title="Only need a break?" text="Log out instead. Nothing is deleted." onClick={logOut} />
      </div>

      <form onSubmit={submit} noValidate className="mt-6 border-t border-border pt-5">
        <FormError>{error}</FormError>
        {usesPassword ? (
          <TextField label="Enter your password to confirm" type="password" autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} />
        ) : (
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            hint="Your account signs in with Google or Apple, so there’s no password to ask for."
          />
        )}
        <Button type="submit" variant="danger" className="w-full ring-1 ring-destructive/30" busy={busy} disabled={!ready}>
          Delete My Account
        </Button>
      </form>
    </Sheet>
  );
}

function Fact({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-card">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate tabular-nums">{text}</span>
    </li>
  );
}

function Step({ when, last = false, children }: { when: string; last?: boolean; children: string }) {
  return (
    <li className="relative">
      <span aria-hidden className={`absolute top-1.5 -left-[calc(1.5625rem+0.5px)] size-2.5 rounded-full ring-4 ring-background ${last ? "bg-destructive" : "bg-faint"}`} />
      <p className="text-sm font-medium">{when}</p>
      <p className="text-sm text-pretty text-muted-foreground">{children}</p>
    </li>
  );
}

function Alternative({ icon: Icon, title, text, onClick, busy = false }: { icon: LucideIcon; title: string; text: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-start gap-3 rounded-xl bg-card p-3 text-left shadow-card transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.98] disabled:opacity-60 pointer-fine:hover:shadow-[0_0_0_1px_var(--line-strong)]"
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{busy ? "Preparing your file…" : title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
