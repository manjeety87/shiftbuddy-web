"use client";

import { CalendarCheck, Navigation, ScanLine, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";

// One email for all three signed-out pages: type it at log in, and it is already
// there when you go to "Create an account" or "Forgot password?".
const AuthEmailContext = createContext<{ email: string; setEmail: (email: string) => void } | null>(null);

export const useAuthEmail = () => {
  const value = useContext(AuthEmailContext);
  if (!value) throw new Error("useAuthEmail needs <AuthFrame>");
  return value;
};

const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ScanLine, title: "Scan or type", text: "Snap the schedule on the wall and the shifts are read for you." },
  { icon: CalendarCheck, title: "See clashes early", text: "Two jobs on the same evening show up before the week starts." },
  { icon: Navigation, title: "Know when to leave", text: "Leave-by times from your door to each workplace." },
];

// A picture of a week, not anyone's data
const SAMPLE_WEEK = [
  { day: "Mon", shifts: [{ colour: "#6b8f71", top: 10, height: 46 }] },
  { day: "Tue", shifts: [{ colour: "#b0674a", top: 38, height: 40 }] },
  { day: "Wed", shifts: [] },
  { day: "Thu", shifts: [{ colour: "#6b8f71", top: 10, height: 34 }, { colour: "#557a95", top: 52, height: 30 }] },
  { day: "Fri", shifts: [{ colour: "#b0674a", top: 30, height: 50 }] },
  { day: "Sat", shifts: [{ colour: "#557a95", top: 6, height: 58 }] },
  { day: "Sun", shifts: [] },
];

/** The first thing a visitor sees, once: this is the one place the page is allowed a little entrance. */
const rise = "transition-[opacity,translate] duration-700 ease-out starting:translate-y-3 starting:opacity-0";

/**
 * Each half keeps its content in a column this wide, set against the middle seam.
 * On a laptop that is the whole half; on a very wide monitor the two sides stay
 * together in the middle instead of drifting to opposite edges.
 */
const HALF = "w-full lg:max-w-[42rem]";

function BrandPanel() {
  return (
    <aside className="hidden justify-end border-r border-border bg-sidebar lg:flex">
      <div className={`flex flex-col p-12 xl:p-16 ${HALF}`}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
            S
          </span>
          <span className="text-lg font-semibold">ShiftBuddy</span>
        </div>

        <div className="my-auto max-w-lg py-10">
          <h2 className={`text-4xl font-bold text-balance xl:text-5xl ${rise}`}>Every shift from every job, in one place.</h2>
          <ul className="mt-9 flex flex-col gap-5">
            {POINTS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className={`flex gap-3.5 ${rise}`} style={{ transitionDelay: `${120 + index * 70}ms` }}>
                <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-card">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="block text-sm text-pretty text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* The picture is the first thing to go when the window is short */}
          <div aria-hidden className={`surface mt-10 grid grid-cols-7 gap-1.5 p-3 [@media(max-height:760px)]:hidden ${rise}`} style={{ transitionDelay: "360ms" }}>
            {SAMPLE_WEEK.map(({ day, shifts }) => (
              <div key={day}>
                <p className="mb-1.5 text-center text-2xs font-medium text-muted-foreground">{day}</p>
                <div className="relative h-20 rounded-md bg-muted/40">
                  {shifts.map((shift) => (
                    <span key={shift.top} className="absolute inset-x-1 rounded-[5px] opacity-85" style={{ top: `${shift.top}%`, height: `${shift.height}%`, backgroundColor: shift.colour }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The page around every signed-out screen. Someone already signed in goes straight to the app. */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const shared = useMemo(() => ({ email, setEmail }), [email]);

  useEffect(() => {
    if (session.status === "signedIn") router.replace("/home");
  }, [session.status, router]);

  return (
    <AuthEmailContext.Provider value={shared}>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <BrandPanel />
        {/* A phone on its side has little height: less air, so the form's button is not below the fold */}
        <main className="flex flex-col justify-center px-5 py-10 [@media(max-height:480px)]:py-5">
          <div className={HALF}>
            <div className="mx-auto w-full max-w-[22rem] sm:max-w-[24rem]">
              <div className="mb-10 flex items-center gap-2.5 lg:hidden [@media(max-height:480px)]:mb-5">
                <span aria-hidden className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground">
                  S
                </span>
                <span className="text-lg font-semibold">ShiftBuddy</span>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </AuthEmailContext.Provider>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-3xl font-bold text-balance">{title}</h1>
      {children && <p className="mt-2 text-base text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

/** A link inside an auth form's error or footer. */
export const authLink = "font-medium text-primary underline-offset-2 pointer-fine:hover:underline";
