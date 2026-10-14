"use client";

import { useEffect, useRef } from 'react';

type Listener = () => void;

/**
 * A tiny in-app "something changed" signal. Mutations call `emit`; screens that
 * show that data call `useChanged(refetch)`, so a change made on another screen
 * (a sheet, an Undo toast) shows up without leaving and coming back.
 */
export const createChangeSignal = () => {
    const listeners = new Set<Listener>();

    const emit = () => {
        listeners.forEach((listener) => listener());
    };

    const useChanged = (onChange: () => void) => {
        const latest = useRef(onChange);
        useEffect(() => {
            latest.current = onChange;
        });
        useEffect(() => {
            const listener = () => latest.current();
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }, []);
    };

    return { emit, useChanged };
};
