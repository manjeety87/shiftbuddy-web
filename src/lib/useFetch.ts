"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "./api";

type LoadMode = "initial" | "background";

export interface FetchState<T> {
  data: T | null;
  /** Nothing to show yet — first load, or the inputs (deps) changed. */
  isLoading: boolean;
  error: string | null;
  /** Quiet refresh: keeps what's on screen, no spinners. */
  refetch: () => Promise<void>;
  /** Try again after an error: shows the loading state. */
  retry: () => Promise<void>;
}

/**
 * Loads data for a page. Only the newest request may update state, so a slow
 * response for last month can't overwrite this month's. A failed background
 * refresh keeps the data already on screen instead of replacing it with an error.
 * Coming back to the tab refreshes quietly, like the mobile app's focus refresh.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const hasData = useRef(false);
  const loadedWith = useRef<unknown>(null);

  // Always call the latest fetcher without making it a dependency (inline arrows change every render)
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(async (mode: LoadMode) => {
    const requestId = ++latestRequest.current;
    if (mode === "initial") setIsLoading(true);

    try {
      const result = await fetcherRef.current();
      if (requestId !== latestRequest.current) return;
      hasData.current = true;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      if (mode === "initial" || !hasData.current) setError(errorMessage(err, "Couldn’t load this. Please try again."));
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
    // `deps` is this hook's own input (like useEffect's), so it can't be a literal here
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);

  // New inputs → old data no longer applies. The same inputs again means the page was
  // only hidden and is back (Next.js keeps pages you navigate away from): keep what
  // was on screen and refresh quietly, so returning to a page never flashes a skeleton.
  useEffect(() => {
    if (loadedWith.current === load && hasData.current) {
      load("background");
      return;
    }
    loadedWith.current = load;
    hasData.current = false;
    setData(null);
    load("initial");
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && hasData.current) load("background");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const refetch = useCallback(() => load("background"), [load]);
  const retry = useCallback(() => load("initial"), [load]);

  return { data, isLoading, error, refetch, retry };
}
