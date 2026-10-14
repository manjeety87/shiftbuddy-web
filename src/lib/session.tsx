"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@/interfaces/user.d";
import { HttpError, refreshSession, useSessionExpired } from "./api";
import { getCurrentUser, logoutUser } from "./auth";
import { showAlert } from "./dialog";
import { clearTokens } from "./storage";

// Who is signed in. On a page load the access token is gone (it lives in memory),
// so the first thing that happens is a refresh: a valid cookie brings the session
// back, no cookie means signed out.

type Session =
  | { status: "loading" }
  | { status: "unreachable" } // the backend didn't answer — not the same as signed out
  | { status: "anonymous" }
  | { status: "signedIn"; user: User };

interface SessionContextValue {
  session: Session;
  /** After a successful login/sign-up call (its token is already stored). */
  signIn: (user: User) => void;
  /** The profile changed (name, home, commute…). */
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// One restore per page load, shared by every caller: refresh tokens rotate, and
// React runs effects twice in development.
let restoring: Promise<User> | null = null;
const restore = () => (restoring ??= refreshSession().then(getCurrentUser));
let signingOut: Promise<void> | null = null;
// "Log out" can be asked for from three places; the question is on screen once
let askingToLogOut = false;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  const load = useCallback(() => {
    restore()
      .then((user) => setSession({ status: "signedIn", user }))
      .catch((error: HttpError) => {
        restoring = null;
        // Signed out for sure: drop the "was signed in" hint too, or the proxy would keep sending this browser to the app
        if (error.response) void clearTokens();
        setSession({ status: error.response ? "anonymous" : "unreachable" });
      });
  }, []);

  useEffect(load, [load]);
  useSessionExpired(() => setSession({ status: "anonymous" }));

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      signIn: (user) => setSession({ status: "signedIn", user }),
      setUser: (user) => setSession({ status: "signedIn", user }),
      // One sign-out at a time: a second call while the first is on its way joins it
      signOut: () =>
        (signingOut ??= (async () => {
          try {
            // The session ends here even if the server can't be told
            await logoutUser().catch(() => clearTokens());
            restoring = null;
            setSession({ status: "anonymous" });
          } finally {
            signingOut = null;
          }
        })()),
      retry: () => {
        setSession({ status: "loading" });
        load();
      },
    }),
    [session, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs <SessionProvider>");
  return value;
};

/** The signed-in user. Only for components under the app layout, which waits for one. */
export const useUser = () => {
  const { session } = useSession();
  if (session.status !== "signedIn") throw new Error("useUser needs a signed-in session");
  return session.user;
};

/**
 * Every "Log out" in the app goes through this: it asks first, because the button
 * sits next to things pressed often and logging back in costs a password.
 */
export const useLogOut = () => {
  const { signOut } = useSession();
  return useCallback(
    () => {
      if (askingToLogOut) return;
      askingToLogOut = true;
      const answered = () => {
        askingToLogOut = false;
      };
      showAlert(
        "Log out of ShiftBuddy?",
        "Are you sure you want to log out of your account?",
        [
          { text: "Cancel", style: "cancel", onPress: answered },
          {
            text: "Log Out",
            onPress: () => {
              answered();
              void signOut(); // the shell sends a signed-out visitor to the login page
            },
          },
        ],
        { onDismiss: answered },
      );
    },
    [signOut],
  );
};
