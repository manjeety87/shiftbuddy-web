"use client";

import { BriefcaseBusiness, ScanLine, Timer, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { setPreference } from "@/lib/preferences";
import { openSheet } from "@/lib/sheets";

// What the app does, in the order a new person meets it. Same words as the phone app's welcome.
const SLIDES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BriefcaseBusiness, title: "Every job in one place", text: "Add each place you work once. Shifts from all your jobs then sit together on one calendar, each in its job’s colour." },
  { icon: ScanLine, title: "Add shifts your way", text: "Type a shift in, or upload a photo or screenshot of the schedule at work. We read the shifts, you check them, then they’re saved." },
  { icon: Timer, title: "Know what’s next", text: "See your next shift, shifts that clash, when to leave, and clock in and out to track the hours you really worked and what you’ll earn." },
];

/**
 * Three short slides a brand-new account sees once on this browser, then Add Job:
 * nothing works until there is a job. Skip or close also counts as seen.
 * The "Getting started" card on Home carries on from here.
 */
export function WelcomeSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const close = () => {
    setPreference("welcomeSeen", "yes");
    onClose();
  };

  const next = () => {
    if (!isLast) return setIndex(index + 1);
    sheet.current?.dismiss();
    openSheet({ kind: "job" });
  };

  return (
    <Sheet ref={sheet} title="Welcome to ShiftBuddy" onClose={close} action={{ label: isLast ? "Add Your First Job" : "Next", onClick: next }}>
      {/* Keyed by slide, so each one fades in; a quick step, never in the way of reading */}
      <div key={index} className="flex flex-col items-center px-2 pt-2 pb-4 text-center transition-[opacity,translate] duration-200 ease-out starting:translate-x-2 starting:opacity-0 motion-reduce:starting:translate-x-0">
        <span aria-hidden className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
          <slide.icon className="size-6.5" />
        </span>
        <h3 className="mb-1.5 text-lg font-semibold">{slide.title}</h3>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">{slide.text}</p>
      </div>

      <p aria-live="polite" className="sr-only">
        Step {index + 1} of {SLIDES.length}
      </p>
      <div className="flex items-center justify-center">
        {SLIDES.map((item, dot) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show step ${dot + 1}`}
            onClick={() => setIndex(dot)}
            // The dot is small to look at; the button around it is big enough to tap
            className="flex h-6 min-w-6 items-center justify-center px-1"
          >
            <span aria-hidden className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${dot === index ? "w-5 bg-primary" : "w-1.5 bg-border-strong"}`} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
