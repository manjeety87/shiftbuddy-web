"use client";

import { BadgeCheck, ChevronRight, ClipboardList, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { errorMessage } from "@/lib/api";
import { deleteAccount, sendVerificationCode, updateProfile } from "@/lib/auth";
import { ARRIVAL_BUFFER_OPTIONS } from "@/lib/commute";
import { showAlert } from "@/lib/dialog";
import { splitAddress } from "@/lib/geocode";
import { notify } from "@/lib/notify";
import { setPreference, usePreference } from "@/lib/preferences";
import { useLogOut, useSession, useUser } from "@/lib/session";
import { openSheet, type SheetRequest } from "@/lib/sheets";

const COMMUTE_MODES = [
  { value: "TRANSIT", label: "Transit" },
  { value: "DRIVING", label: "Driving" },
] as const;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "commute", label: "Home & commute" },
  { id: "pay", label: "Pay estimates" },
  { id: "home", label: "Home page" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
] as const;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    // scroll-mt keeps the heading clear of the page bar when the section nav jumps here
    <section aria-labelledby={`${id}-title`} id={id} className="mb-9 scroll-mt-24">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{description}</p>}
      <div className="surface mt-3 divide-y divide-border">{children}</div>
    </section>
  );
}

/** One setting: what it is on the left, its control on the right. On a phone the control drops under the label. */
function Setting({ label, help, htmlFor, children }: { label: string; help?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[55%]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm font-medium">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium">{label}</p>
        )}
        {help && <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{help}</p>}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function PhoneLink({ icon: Icon, label, detail, href }: { icon: LucideIcon; label: string; detail: string; href: string }) {
  return (
    <Link href={href} className="flex min-h-13 items-center gap-3 px-4 py-2.5 text-sm row-hover">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="truncate text-muted-foreground">{detail}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

export function SettingsPage() {
  const user = useUser();
  const { setUser, signOut } = useSession();
  const logOut = useLogOut();
  const [name, setName] = useState(user.name);
  const [tax, setTax] = useState(String(user.taxDeductionPercent));
  const [saving, setSaving] = useState<"name" | "tax" | null>(null);
  const showShared = usePreference("sharedOnHome") === "on";

  // Settings apply as they're chosen; only free text needs a Save. The choice shows
  // at once (a control that waits for the server feels broken) and goes back if the save fails.
  const apply = async (changes: Parameters<typeof updateProfile>[0], done?: string) => {
    setUser({ ...user, ...changes });
    try {
      setUser(await updateProfile(changes));
      if (done) notify.success(done);
    } catch (failure) {
      setUser(user);
      notify.error("Couldn’t save that", { description: errorMessage(failure) });
    }
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setSaving("name");
    await apply({ name: name.trim() }, "Name saved");
    setSaving(null);
  };

  const taxValue = Number(tax);
  const taxError = tax.trim() === "" || !(taxValue >= 0 && taxValue <= 100) ? "Enter a percentage from 0 to 100" : null;
  const saveTax = async (event: FormEvent) => {
    event.preventDefault();
    setSaving("tax");
    await apply({ taxDeductionPercent: taxValue }, "Deductions saved");
    setSaving(null);
  };

  const verify = async () => {
    openSheet({ kind: "verifyEmail" } satisfies SheetRequest);
    // A fresh code, in case the one from sign-up has expired
    await sendVerificationCode().catch(() => undefined);
  };

  const removeAccount = () =>
    showAlert("Delete your account?", "Your jobs, shifts, timesheet and shares are deleted for good. This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Account",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAccount();
            notify.success("Account deleted");
            await signOut();
          } catch (failure) {
            notify.error("Couldn’t delete the account", { description: errorMessage(failure) });
          }
        },
      },
    ]);

  return (
    <>
      <PageHeader title="Settings" />

      <div className="grid items-start gap-10 lg:grid-cols-[11rem_minmax(0,44rem)]">
        {/* With room, the sections are listed beside the page; a phone just scrolls */}
        <nav aria-label="Settings sections" className="sticky top-24 hidden flex-col gap-0.5 lg:flex">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground row-hover pointer-fine:hover:text-foreground">
              {section.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0">
          <Section id="profile" title="Profile">
            <form onSubmit={saveName}>
              <Setting label="Name" htmlFor="settings-name" help="Shown to people you share your schedule with.">
                <input id="settings-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} sm:w-56`} />
                <Button type="submit" variant="secondary" busy={saving === "name"} disabled={name.trim().length < 2 || name.trim() === user.name}>
                  Save
                </Button>
              </Setting>
            </form>
            <Setting label="Email" help={user.isEmailVerified ? undefined : "Verify it to receive schedules people share with you."}>
              <span className="min-w-0 truncate text-sm text-muted-foreground">{user.email}</span>
              {user.isEmailVerified ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                  <BadgeCheck aria-hidden className="size-4" /> Verified
                </span>
              ) : (
                <Button variant="secondary" size="sm" onClick={verify}>
                  Verify Email
                </Button>
              )}
            </Setting>
          </Section>

          <Section id="commute" title="Home & commute" description="Used to work out when to leave for a shift, and whether two shifts are too close to travel between.">
            <Setting label="Home address" help={user.homeLocation ? splitAddress(user.homeLocation.address).title : "Not set — leave-by times need it."}>
              <Button variant="secondary" onClick={() => openSheet({ kind: "home" })}>
                {user.homeLocation ? "Change" : "Add Address"}
              </Button>
            </Setting>
            <Setting label="I usually get to work by">
              <SegmentedControl label="How you get to work" options={COMMUTE_MODES} value={user.commuteMode} onChange={(commuteMode) => apply({ commuteMode })} className="w-full sm:w-48" />
            </Setting>
            <Setting label="I like to arrive" help="Leave-by times and routes are planned to get you there this early.">
              <SegmentedControl label="How early you like to arrive" options={ARRIVAL_BUFFER_OPTIONS} value={String(user.arrivalBufferMinutes) as "0"} onChange={(value) => apply({ arrivalBufferMinutes: Number(value) })} className="w-full sm:w-80" />
            </Setting>
          </Section>

          <Section id="pay" title="Pay estimates">
            <form onSubmit={saveTax}>
              <Setting label="Deductions (%)" htmlFor="settings-tax" help={taxError ? <span className="text-destructive">{taxError}</span> : "Taken off estimated pay to show roughly what lands in your account."}>
                <input
                  id="settings-tax"
                  inputMode="decimal"
                  aria-invalid={taxError ? true : undefined}
                  value={tax}
                  onChange={(event) => setTax(event.target.value.replace(/[^0-9.]/g, ""))}
                  className={`${inputClass} text-right tabular-nums sm:w-24`}
                />
                <Button type="submit" variant="secondary" busy={saving === "tax"} disabled={!!taxError || taxValue === user.taxDeductionPercent}>
                  Save
                </Button>
              </Setting>
            </form>
          </Section>

          <Section id="home" title="Home page" description="What your Home calendar shows, on this browser.">
            <Setting label="Schedules shared with me" help="Shifts from people who share their schedule with you appear on your Home calendar next to your own. Turn this off to see only yours — their schedules stay under Sharing.">
              <Switch label="Show schedules shared with me on Home" checked={showShared} onChange={(checked) => setPreference("sharedOnHome", checked ? "on" : "off")} />
            </Setting>
          </Section>

          <Section id="appearance" title="Appearance" description="Applies as soon as you pick one, on this browser.">
            <div className="p-4">
              <ThemePicker />
            </div>
          </Section>

          {/* The sidebar already lists these; a phone's tab bar has no room for them */}
          <section aria-label="More" className="surface mb-9 divide-y divide-border overflow-hidden md:hidden">
            <PhoneLink icon={ClipboardList} label="Timesheet" detail="Hours you worked" href="/timesheet" />
            <PhoneLink icon={Users} label="Sharing" detail="Send or share your schedule" href="/sharing" />
          </section>

          <Section id="account" title="Account">
            {user.hasPassword && (
              <Setting label="Password" help="Changing it signs out your other devices.">
                <Button variant="secondary" onClick={() => openSheet({ kind: "password" })}>
                  Change Password
                </Button>
              </Setting>
            )}
            <Setting label="Log out" help={`Signed in as ${user.email}.`}>
              <Button variant="secondary" onClick={logOut}>
                Log out
              </Button>
            </Setting>
            <Setting label="Delete account" help="Your jobs, shifts, timesheet and shares are deleted for good.">
              <Button variant="danger" className="shadow-[0_0_0_1px_color-mix(in_oklab,var(--destructive)_35%,transparent)]" onClick={removeAccount}>
                Delete account
              </Button>
            </Setting>
          </Section>
        </div>
      </div>
    </>
  );
}
