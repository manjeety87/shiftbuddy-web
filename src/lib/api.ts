import { createChangeSignal } from "./changeSignal";
import { clearTokens, getAccessToken, saveTokens } from "./storage";

// The one door to the backend. Calls go to `/api/...` on this site and Next.js
// forwards them (see next.config.ts), so the refresh cookie is first-party.
//
// The surface mirrors the mobile app's axios client (`api.get<T>(url, { params })`
// resolving to `{ data }`, errors carrying `response.status` / `response.data`),
// so the feature files in `lib/` are the same code on both apps.

const BASE = "/api";
const DEFAULT_TIMEOUT_MS = 15000;
// Tells the backend to keep the refresh token in an httpOnly cookie. A custom
// header also can't be sent by another website's form — that's the CSRF guard.
const TRANSPORT = { "X-Auth-Transport": "cookie" };

interface RequestOptions {
  params?: Record<string, unknown>;
  timeout?: number;
  /** Accepted for parity with the mobile client; fetch sets multipart headers itself */
  headers?: Record<string, string>;
  /** "blob" for a file (a PDF); errors still come back as JSON */
  responseType?: "json" | "blob";
}

export class HttpError extends Error {
  /** Missing when the request never got an answer (offline, server down, timed out) */
  response?: { status: number; data: { message?: string; details?: unknown } | null };
}

const sessionExpired = createChangeSignal();
/** Runs when the server has ended the session (not on a dropped connection). */
export const useSessionExpired = sessionExpired.useChanged;

const withParams = (url: string, params?: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });
  const text = query.toString();
  return `${BASE}${url}${text ? `?${text}` : ""}`;
};

const send = async (method: string, url: string, body: unknown, options: RequestOptions = {}) => {
  const token = getAccessToken();
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(withParams(url, options.params), {
      method,
      headers: {
        ...TRANSPORT,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "same-origin",
      signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError("Network request failed");
  }
  if (response.ok && options.responseType === "blob") return { data: await response.blob() };
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new HttpError(data?.message ?? `Request failed (${response.status})`);
    error.response = { status: response.status, data };
    throw error;
  }
  return { data };
};

// One refresh at a time, in this tab and across tabs. A page fires several
// requests at once and they all get 401 together; refresh tokens rotate, so a
// second refresh with the old cookie would look like theft and end the session.
let refreshInFlight: Promise<string> | null = null;

const runRefresh = async () => {
  const { data } = await send("POST", "/auth/refresh-token", {});
  await saveTokens(data.data.accessToken);
  return data.data.accessToken as string;
};

const refreshUnderLock = async (): Promise<string> =>
  typeof navigator !== "undefined" && navigator.locks ? await navigator.locks.request("shiftbuddy-refresh", runRefresh) : runRefresh();

export const refreshSession = (): Promise<string> => {
  refreshInFlight ??= refreshUnderLock().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

// On these a 401 means "wrong email/password/code", not "session expired"
const CREDENTIAL_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/google", "/auth/apple", "/auth/restore", "/auth/forgot-password", "/auth/reset-password", "/auth/change-password", "/auth/refresh-token", "/account/deletion"];

const request = async <T>(method: string, url: string, body?: unknown, options?: RequestOptions): Promise<{ data: T }> => {
  try {
    return (await send(method, url, body, options)) as { data: T };
  } catch (error) {
    const status = (error as HttpError).response?.status;
    if (status !== 401 || CREDENTIAL_ENDPOINTS.some((path) => url.startsWith(path))) throw error;

    try {
      await refreshSession();
    } catch (refreshError) {
      // Only a refusal from the server ends the session; a dropped connection doesn't
      if ((refreshError as HttpError).response) {
        await clearTokens();
        sessionExpired.emit();
      }
      throw refreshError;
    }
    return (await send(method, url, body, options)) as { data: T };
  }
};

export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) => request<T>("GET", url, undefined, options),
  delete: <T = unknown>(url: string, options?: RequestOptions) => request<T>("DELETE", url, undefined, options),
  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => request<T>("POST", url, body ?? {}, options),
  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", url, body ?? {}, options),
  patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", url, body ?? {}, options),
};

/** The message to show for a failed call: the backend's own words, or a plain fallback. */
export const errorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  const failure = error as HttpError;
  if (!failure?.response) return "Can’t reach ShiftBuddy. Check your connection and try again.";
  return failure.response.data?.message || fallback;
};

/** The machine-readable reason some errors carry (e.g. NO_ACCOUNT, ENTRY_EXISTS), for when the screen must react to it. */
export const errorCode = (error: unknown): string | undefined => ((error as HttpError)?.response?.data?.details as { code?: string } | null | undefined)?.code;
