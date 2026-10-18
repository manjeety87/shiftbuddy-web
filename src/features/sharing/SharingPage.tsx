"use client";

import { ChevronRight, Copy, Share2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError, inputClass, selectClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { errorMessage } from "@/lib/api";
import { showAlert } from "@/lib/dialog";
import { notify } from "@/lib/notify";
import { setPreference, usePreference } from "@/lib/preferences";
import { getScheduleMessage, type ScheduleNameStyle, type ScheduleRange } from "@/lib/scheduleMessage";
import { useUser } from "@/lib/session";
import { formatShareExpiry, getIncomingShares, getOutgoingShares, SHARE_DURATIONS, shareShifts, stopSharing, type ShareDuration } from "@/lib/shares";
import { useShiftsChanged } from "@/lib/shiftEvents";
import { formatDuration } from "@/lib/shiftTime";
import { openSheet } from "@/lib/sheets";
import { useFetch } from "@/lib/useFetch";

const RANGES = [
  { value: "thisWeek", label: "This week" },
  { value: "nextWeek", label: "Next week" },
  { value: "thisMonth", label: "This month" },
] as const;

const NAME_STYLES = [
  { value: "workplace", label: "Workplace" },
  { value: "job", label: "Role" },
] as const;

const DAYS_OFF = [
  { value: "true", label: "Show" },
  { value: "false", label: "Hide" },
] as const;

const optionLabel = "mb-1.5 text-sm font-medium";

/** Your schedule as plain text for a chat — a snapshot. The backend writes it, so the phone app sends the same words. */
function ScheduleMessageCard() {
  const [range, setRange] = useState<ScheduleRange>("thisWeek");
  const [nameStyle, setNameStyle] = useState<ScheduleNameStyle>("workplace");
  const [includeDaysOff, setIncludeDaysOff] = useState(true);
  const { data, error, retry, refetch } = useFetch(() => getScheduleMessage({ range, nameStyle, includeDaysOff }), [range, nameStyle, includeDaysOff]);
  useShiftsChanged(refetch);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.message);
      notify.success("Schedule copied", { description: "Paste it into any chat." });
    } catch {
      notify.error("Couldn’t copy", { description: "Select the text and copy it yourself." });
    }
  };

  const share = async () => {
    if (!data) return;
    // The person closing the share menu is not an error
    await navigator.share({ text: data.message }).catch(() => undefined);
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section aria-labelledby="message-title" className="mb-10">
      <h2 id="message-title" className="text-lg font-semibold">
        Send your schedule as a message
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">A snapshot in plain text, for any chat. It doesn’t update after you send it.</p>

      {/* Choices on the left, the result on the right: every change shows at once in what you'll send */}
      <div className="surface grid overflow-hidden md:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 border-b border-border p-4 md:border-r md:border-b-0">
          <div>
            <p className={optionLabel}>Which days</p>
            <SegmentedControl label="Which days" options={RANGES} value={range} onChange={setRange} />
          </div>
          <div>
            <p className={optionLabel}>Name jobs by</p>
            <SegmentedControl label="How jobs are named" options={NAME_STYLES} value={nameStyle} onChange={setNameStyle} />
          </div>
          <div>
            <p className={optionLabel}>Days off</p>
            <SegmentedControl label="Days off" options={DAYS_OFF} value={String(includeDaysOff) as "true" | "false"} onChange={(value) => setIncludeDaysOff(value === "true")} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col bg-muted/25 p-4">
          {error ? (
            <LoadError message={error} onRetry={retry} />
          ) : !data ? (
            <SkeletonRows rows={1} className="h-40" />
          ) : (
            <>
              <pre className="max-h-80 flex-1 overflow-y-auto rounded-2xl rounded-bl-md bg-card p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap shadow-card select-all">{data.message}</pre>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-xs text-muted-foreground tabular-nums">
                  {data.shiftCount} shift{data.shiftCount === 1 ? "" : "s"} · {formatDuration(data.totalMinutes)}
                </p>
                {canShare && (
                  <Button variant="secondary" icon={<Share2 aria-hidden className="size-3.5" />} onClick={share}>
                    Share
                  </Button>
                )}
                <Button icon={<Copy aria-hidden className="size-3.5" />} onClick={copy}>
                  Copy
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function SharingPage() {
  const user = useUser();
  const showOnHome = usePreference("sharedOnHome") === "on";
  const outgoing = useFetch(getOutgoingShares);
  const incoming = useFetch(getIncomingShares);
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState<ShareDuration>("month");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const share = await shareShifts(email, duration);
      notify.success(share.status === "active" ? `Now sharing with ${share.name ?? share.email}` : `Invite saved for ${share.email}`, {
        description: share.status === "pending" ? "They’ll see your schedule once they sign up with that email and verify it." : undefined,
      });
      setEmail("");
      outgoing.refetch();
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t share your schedule."));
    } finally {
      setBusy(false);
    }
  };

  const stop = (shareId: string, title: string, message: string, done: string, refresh: () => void) =>
    showAlert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          try {
            await stopSharing(shareId);
            notify.success(done);
            refresh();
          } catch (failure) {
            notify.error("Couldn’t do that", { description: errorMessage(failure) });
          }
        },
      },
    ]);

  return (
    <>
      {/* A phone reaches this page from Settings (no room for it in the tab bar) */}
      <PageHeader title="Sharing" description="Send a snapshot of your week, or let someone see your schedule as it changes." back={{ label: "Settings", href: "/settings" }} />

      <ScheduleMessageCard />

      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="live-title">
          <h2 id="live-title" className="text-lg font-semibold">
            Share your live schedule
          </h2>
          <p className="mt-0.5 mb-3 text-sm text-pretty text-muted-foreground">They see your shift times and where you work — never your pay, notes or home address. You can stop any time.</p>

          <form onSubmit={invite} noValidate className="surface p-4">
            <FormError>{error}</FormError>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1">
                <span className="mb-1.5 block text-sm font-medium">Their email</span>
                <input type="email" inputMode="email" autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium">For</span>
                <select value={duration} onChange={(event) => setDuration(event.target.value as ShareDuration)} className={selectClass}>
                  {SHARE_DURATIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" busy={busy} disabled={!email.trim()}>
                Share My Schedule
              </Button>
            </div>
          </form>

          <div className="mt-3">
            {outgoing.error ? (
              <LoadError message={outgoing.error} onRetry={outgoing.retry} />
            ) : !outgoing.data ? (
              <SkeletonRows rows={1} />
            ) : outgoing.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">You aren’t sharing your schedule with anyone.</p>
            ) : (
              <ul className="surface divide-y divide-border overflow-hidden">
                {outgoing.data.map((share) => (
                  <li key={share.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{share.name ?? share.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {share.status === "pending" ? "Waiting for them to join with this email · " : share.name ? `${share.email} · ` : ""}
                        {formatShareExpiry(share.expiresAt)}
                      </span>
                    </span>
                    <Button variant="danger" size="sm" onClick={() => stop(share.id, "Stop sharing?", `${share.name ?? share.email} will no longer see your schedule.`, "Stopped sharing", outgoing.refetch)}>
                      Stop
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="received-title">
          <h2 id="received-title" className="text-lg font-semibold">
            Shared with you
          </h2>
          <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Schedules other people let you see. Read-only.</p>

          {!user.isEmailVerified && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-warning/15 px-4 py-3">
              <p className="flex-1 text-sm text-pretty">Verify your email to receive schedules people share with {user.email}.</p>
              <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "verifyEmail" })}>
                Verify Email
              </Button>
            </div>
          )}
          {incoming.error ? (
            <LoadError message={incoming.error} onRetry={incoming.retry} />
          ) : !incoming.data ? (
            <SkeletonRows rows={1} />
          ) : incoming.data.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-sm text-muted-foreground">Nobody is sharing a schedule with you yet.</p>
          ) : (
            <ul className="surface divide-y divide-border overflow-hidden">
              {incoming.data.map((share) => (
                <li key={share.id} className="flex items-center gap-1 pr-2">
                  <button type="button" onClick={() => openSheet({ kind: "shared", ownerId: share.owner.id, ownerName: share.owner.name.split(" ")[0] })} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left row-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{share.owner.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatShareExpiry(share.expiresAt, "Until they stop sharing")}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                  </button>
                  <Button variant="quiet" size="sm" onClick={() => stop(share.id, "Remove this schedule?", `${share.owner.name}’s schedule will disappear from your list. They can share it again.`, "Removed", incoming.refetch)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* The same switch as Settings → Home page, here where the schedules it is about are listed */}
          {incoming.data && incoming.data.length > 0 && (
            <div className="surface mt-3 flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Show on Home</p>
                <p className="mt-0.5 text-xs text-pretty text-muted-foreground">Their shifts sit on your Home calendar next to your own. Off, they stay only on this page.</p>
              </div>
              <Switch label="Show schedules shared with me on Home" checked={showOnHome} onChange={(checked) => setPreference("sharedOnHome", checked ? "on" : "off")} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
