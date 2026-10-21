"use client";

import { HelpCircle, Laptop, Smartphone, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import type { SignedInDevice } from "@/interfaces/account.d";
import { getSignedInDevices, signOutDevice, signOutOtherDevices } from "@/lib/account";
import { errorMessage } from "@/lib/api";
import { showAlert } from "@/lib/dialog";
import { notify } from "@/lib/notify";
import { useFetch } from "@/lib/useFetch";

const ICONS: Record<SignedInDevice["device"]["kind"], LucideIcon> = { browser: Laptop, app: Smartphone, unknown: HelpCircle };

const MINUTE_MS = 60 * 1000;
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "Active now", "Active 3 hours ago", "Active yesterday" */
const activeLabel = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / MINUTE_MS);
  if (minutes < 5) return "Active now";
  if (minutes < 60) return `Active ${relative.format(-minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${relative.format(-hours, "hour")}`;
  return `Active ${relative.format(-Math.round(hours / 24), "day")}`;
};
const signedInLabel = (iso: string) => `Signed in ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

/**
 * Every browser and phone signed in to this account, this one first. Another one
 * signs out with one press (nothing is lost, they just log in again there); all
 * of them at once asks first.
 */
export function SignedInDevices() {
  const { data: devices, isLoading, error, retry, refetch } = useFetch(getSignedInDevices);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <SkeletonRows rows={2} className="mx-4 my-3 h-12" />;
  if (error || !devices) return <LoadError message="Couldn’t load where you’re signed in." onRetry={retry} />;

  const others = devices.filter((device) => !device.isCurrent);

  const signOutOne = async (device: SignedInDevice) => {
    setBusy(device.id);
    try {
      await signOutDevice(device.id);
      notify.success(`Signed out of ${device.device.name}`);
    } catch (failure) {
      notify.error("Couldn’t sign that device out", { description: errorMessage(failure) });
    } finally {
      await refetch();
      setBusy(null);
    }
  };

  const signOutOthers = () =>
    showAlert(`Sign out of ${others.length === 1 ? "1 other device" : `${others.length} other devices`}?`, "You stay signed in here. Anyone using ShiftBuddy on them will need to log in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setBusy("others");
          try {
            const count = await signOutOtherDevices();
            notify.success(count === 1 ? "Signed out of 1 other device" : `Signed out of ${count} other devices`);
          } catch (failure) {
            notify.error("Couldn’t sign the other devices out", { description: errorMessage(failure) });
          } finally {
            await refetch();
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <div className="divide-y divide-border">
      {devices.map((device) => {
        const Icon = ICONS[device.device.kind];
        return (
          <div key={device.id} className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                <span className="truncate">{device.device.name}</span>
                {device.isCurrent && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">This device</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {device.isCurrent ? "Active now" : activeLabel(device.lastUsedAt)} · {signedInLabel(device.createdAt)}
              </p>
            </div>
            {!device.isCurrent && (
              <Button variant="secondary" size="sm" busy={busy === device.id} disabled={busy !== null} onClick={() => signOutOne(device)}>
                Sign out
              </Button>
            )}
          </div>
        );
      })}
      {others.length > 0 ? (
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-pretty text-muted-foreground">Don’t recognise one, or left yourself signed in somewhere?</p>
          <Button variant="danger" size="sm" className="ring-1 ring-destructive/30" busy={busy === "others"} disabled={busy !== null} onClick={signOutOthers}>
            Sign out of all others
          </Button>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">You’re only signed in here.</p>
      )}
    </div>
  );
}
