// Where the session lives in a browser. The access token is kept in memory only —
// a page can't keep a secret, so nothing goes in localStorage. The refresh token
// never reaches this code at all: the backend sets it as an httpOnly cookie.

import { SIGNED_IN_COOKIE } from "./sessionMarker";

let accessToken: string | null = null;

// A hint for `proxy.ts`, which runs before a page renders and can't see the refresh
// cookie (that one is only sent to /api/auth). It says "this browser was signed in",
// nothing more — it grants no access; the backend checks the real token on every call.
const markSignedIn = (isSignedIn: boolean) => {
  if (typeof document === "undefined") return;
  document.cookie = `${SIGNED_IN_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${isSignedIn ? 60 * 60 * 24 * 30 : 0}`;
};

export const getAccessToken = () => accessToken;

export const saveTokens = async (token: string) => {
  accessToken = token;
  markSignedIn(true);
};

export const clearTokens = async () => {
  accessToken = null;
  markSignedIn(false);
};
