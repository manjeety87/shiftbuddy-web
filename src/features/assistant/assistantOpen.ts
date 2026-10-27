"use client";

import { useSyncExternalStore } from "react";

// Whether the assistant is open, and whether it should start listening as it opens.
// Anything can open it (the sidebar, the phone's button, Ctrl/⌘ J); `Assistant` in the
// app shell draws it.

interface OpenState {
  open: boolean;
  /** Opened by a mic button: listening starts at once. Opened to type: it doesn't. */
  listen: boolean;
}

let state: OpenState = { open: false, listen: false };
const listeners = new Set<() => void>();

const publish = (next: OpenState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

export const openAssistant = (listen = true) => publish({ open: true, listen });
export const closeAssistant = () => publish({ open: false, listen: false });
export const toggleAssistant = () => (state.open ? closeAssistant() : openAssistant());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const CLOSED: OpenState = { open: false, listen: false };

export const useAssistantOpen = () => useSyncExternalStore(subscribe, () => state, () => CLOSED);

/** Runs `onChange` with the new state each time the assistant opens or closes. */
export const onAssistantOpenChange = (onChange: (next: OpenState) => void) => subscribe(() => onChange(state));
