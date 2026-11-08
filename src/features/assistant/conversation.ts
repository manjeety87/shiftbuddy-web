import type { Message } from "./AssistantPanel";

// The conversation, kept in this browser so a reload or a new visit carries on where
// the person stopped. Per account (another account on this browser starts fresh),
// for a day after the last message, and wiped on log out — it holds their schedule.
// A card that was waiting is never kept: by the time they come back it may not fit.

const KEY_PREFIX = "shiftbuddy.assistant.";
/** A conversation this old is a new day's conversation */
const KEEP_FOR_MS = 24 * 60 * 60 * 1000;
/** Enough to scroll back through; the backend only ever reads the last 12 */
const MAX_KEPT = 60;

interface Kept {
  savedAt: number;
  messages: Message[];
}

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

const isMessage = (value: unknown): value is Message => {
  const line = value as Message;
  return typeof line?.id === "number" && (line.role === "user" || line.role === "assistant") && typeof line.text === "string";
};

/** The conversation to carry on with, or none (nothing kept, too old, or storage blocked). */
export const loadConversation = (userId: string): Message[] => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const kept = JSON.parse(raw) as Kept;
    if (typeof kept.savedAt !== "number" || Date.now() - kept.savedAt > KEEP_FOR_MS || !Array.isArray(kept.messages)) {
      localStorage.removeItem(keyFor(userId));
      return [];
    }
    return kept.messages.filter(isMessage);
  } catch {
    // Storage blocked (private window) or an entry this version can't read: start fresh
    return [];
  }
};

export const saveConversation = (userId: string, messages: Message[]) => {
  try {
    if (messages.length === 0) localStorage.removeItem(keyFor(userId));
    else localStorage.setItem(keyFor(userId), JSON.stringify({ savedAt: Date.now(), messages: messages.slice(-MAX_KEPT) } satisfies Kept));
  } catch {
    // Storage blocked or full: the conversation still works, it just won't be there next time
  }
};

/** On log out: every account's conversation on this browser goes. */
export const forgetConversations = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage blocked: nothing was kept
  }
};
