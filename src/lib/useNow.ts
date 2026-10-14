"use client";

import { useEffect, useState } from 'react';

const MINUTE_MS = 60 * 1000;

/** The current time, refreshed every minute — for "in 2h 10m" labels and "Now" badges that must not go stale. */
export function useNow(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
        return () => clearInterval(timer);
    }, []);

    return now;
}
