"use client";

import { ArrowUp, Check, Maximize2, Mic, SquarePen, Square, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Spinner } from "@/components/ui/Button";
import type { Proposal, Saved } from "@/lib/assistant";
import { ProposalCard } from "./ProposalCard";
import { useMicLevel, type ListenError } from "./speech";

export interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** The service failed; not sent back as part of the conversation */
  failed?: boolean;
  /** What to send again after a failure */
  retry?: string;
  saved?: Saved;
  undone?: boolean;
}

type Phase = "idle" | "thinking" | "speaking";

// Ways in, in the voices people actually use: plain English, Hinglish, a question, a place
const EXAMPLES = ["Add a shift tomorrow, 9 to 5", "Kal 9 se 5 ki shift hai", "Wednesday ko nahi ja paunga", "When is my next shift?", "Show my calendar"];

const LISTEN_ERRORS: Record<ListenError, string> = {
  blocked: "The microphone is blocked. Allow it from the address bar, or type instead.",
  "no-mic": "No microphone found. Type instead.",
  unavailable: "This browser can’t use the microphone. Type instead.",
};

interface PanelProps {
  overDialog: boolean;
  messages: Message[];
  pending: Proposal | null;
  phase: Phase;
  listening: boolean;
  listenError: ListenError | null;
  canListen: boolean;
  voice: "on" | "off";
  draft: string;
  saving: boolean;
  onDraft: (text: string) => void;
  onSend: (text: string) => void;
  onMic: () => void;
  onStopSpeaking: () => void;
  onSave: () => void;
  onDismissCard: () => void;
  onNewChat: () => void;
  /** Ask once whether to keep chats (the Remember assistant chats feature) */
  askToRemember: boolean;
  onRemember: (keep: boolean) => void;
  onUndo: (message: Message) => void;
  onVoice: (voice: "on" | "off") => void;
  onClose: () => void;
}

// Leaving is quicker than arriving (180 ms): the person has already moved on
const CARD_EXIT_MS = 150;

/**
 * The card on screen, which stays a moment after `pending` goes so it can slide away
 * instead of vanishing. A new card replaces it at once and slides in (a new `key`).
 */
function useLeavingCard(pending: Proposal | null) {
  const [shown, setShown] = useState(pending);
  // A new card arrives: show it now (adjusted while rendering, not in an effect)
  if (pending !== null && pending !== shown) setShown(pending);
  const leaving = pending === null && shown !== null;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShown(null), CARD_EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return { shown, leaving, key: shown ? `${shown.type}:${JSON.stringify(shown.preview)}` : "" };
}

/**
 * The microphone. Its halo follows the voice it hears (`--level`, set by the panel),
 * so the person sees they're being heard before a word appears.
 */
function MicButton({ phase, listening, disabled, onMic, onStopSpeaking, size = "md" }: { phase: Phase; listening: boolean; disabled: boolean; onMic: () => void; onStopSpeaking: () => void; size?: "md" | "sm" }) {
  const speaking = phase === "speaking";
  const label = speaking ? "Stop speaking" : listening ? "Stop listening" : "Talk";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={listening}
      disabled={disabled || phase === "thinking"}
      onClick={speaking ? onStopSpeaking : onMic}
      data-listening={listening || undefined}
      className={`mic-button relative flex shrink-0 items-center justify-center rounded-full transition-[scale,background-color,color] duration-150 ease-out active:scale-90 disabled:opacity-45 ${size === "sm" ? "size-8" : "size-11"} ${
        listening ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary pointer-fine:hover:bg-primary/18"
      }`}
    >
      {listening && <span aria-hidden className="mic-halo absolute inset-0 rounded-full bg-primary" />}
      <span className="relative">
        {phase === "thinking" ? <Spinner className={size === "sm" ? "size-3.5" : "size-4"} /> : speaking ? <Square aria-hidden className="size-3.5 fill-current" /> : <Mic aria-hidden className={size === "sm" ? "size-4" : "size-5"} />}
      </span>
    </button>
  );
}

/**
 * A panel that floats beside the page instead of covering it (no dimmed backdrop:
 * the person keeps working while they talk). Bottom right with a pointer, above the
 * tab bar on a phone. While a shift's panel is open on top, it shrinks to a pill at
 * the top so the panel stays readable — and keeps listening.
 */
export function AssistantPanel(props: PanelProps) {
  const { overDialog, messages, pending, phase, listening, listenError, canListen, voice, draft, saving } = props;
  const [expanded, setExpanded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // The voice level goes to the parts that move with it: the header's bars and the mic (or the pill)
  const header = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const asPill = overDialog && !expanded;
  const levelTargets = useMemo(() => (asPill ? [pill] : [header, footer]), [asPill]);
  useMicLevel(listening, levelTargets);
  const input = useRef<HTMLInputElement>(null);

  const card = useLeavingCard(pending);

  // The newest line and the card stay in view (and again once a card has gone)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, phase, card.shown]);

  // Opened to type (not by a mic): the cursor is ready
  useEffect(() => {
    if (!listening && !overDialog) input.current?.focus({ preventScroll: true });
    // Only as it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    // Ours, not the shift panel's underneath
    event.preventDefault();
    event.stopPropagation();
    props.onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSend(draft);
  };

  const status = listenError
    ? LISTEN_ERRORS[listenError]
    : !canListen
      ? LISTEN_ERRORS.unavailable
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? "Speaking…"
          : listening
            ? "Listening…"
            : "Tap the mic and talk, or type.";

  const lastReply = [...messages].reverse().find((message) => message.role === "assistant");

  if (asPill) {
    return (
      <div ref={pill} role="region" aria-label="Assistant" onKeyDown={onKeyDown} className="assistant-pill frosted fixed top-3 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-card/85 py-1.5 pr-1.5 pl-1.5 shadow-pop backdrop-blur-xl backdrop-saturate-150">
        {canListen && <MicButton size="sm" phase={phase} listening={listening} disabled={false} onMic={props.onMic} onStopSpeaking={props.onStopSpeaking} />}
        <p aria-live="polite" className="max-w-80 min-w-0 truncate text-sm">
          {pending ? (listening ? "A card is waiting — say “yes”, or open it" : "A card is waiting") : phase === "idle" && lastReply ? lastReply.text : status}
        </p>
        <button type="button" aria-label="Open the assistant" title="Open the assistant" onClick={() => setExpanded(true)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-hover">
          <Maximize2 aria-hidden className="size-3.5" />
        </button>
        <button type="button" aria-label="Close the assistant" title="Close" onClick={props.onClose} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-hover">
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-label="Assistant"
      onKeyDown={onKeyDown}
      className="assistant-panel frosted fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 flex max-h-[min(34rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl bg-background/90 shadow-modal backdrop-blur-xl backdrop-saturate-150 md:inset-x-auto md:right-6 md:bottom-6 md:max-h-[min(38rem,calc(100dvh-3rem))] md:w-[23.5rem]"
    >
      {/* While the microphone is open the header becomes a field of the accent, with bars that
          move with the voice: you can tell from across the room that it is listening */}
      <header
        ref={header}
        data-listening={listening || undefined}
        className={`assistant-header flex h-12 shrink-0 items-center gap-1 border-b pr-2 pl-4 ${listening ? "border-transparent bg-primary text-primary-foreground" : "border-border"}`}
      >
        <h2 className="flex min-w-0 flex-1 items-center gap-2.5 truncate text-base font-semibold">
          {listening ? (
            <>
              <span aria-hidden className="level-bars flex h-4 items-center gap-[3px]">
                <span style={{ ["--reach" as string]: 0.55 }} />
                <span style={{ ["--reach" as string]: 1 }} />
                <span style={{ ["--reach" as string]: 0.8 }} />
                <span style={{ ["--reach" as string]: 0.45 }} />
              </span>
              Listening
            </>
          ) : (
            "Assistant"
          )}
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            aria-label="New conversation"
            title="New conversation"
            onClick={props.onNewChat}
            className={`flex size-8 items-center justify-center rounded-full transition-[scale,background-color,color] duration-150 ease-out active:scale-90 ${listening ? "text-primary-foreground/80 pointer-fine:hover:bg-primary-foreground/15 pointer-fine:hover:text-primary-foreground" : "text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"}`}
          >
            <SquarePen aria-hidden className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={voice === "on" ? "Stop reading replies aloud" : "Read replies aloud"}
          title={voice === "on" ? "Replies are read aloud" : "Replies are silent"}
          aria-pressed={voice === "on"}
          onClick={() => props.onVoice(voice === "on" ? "off" : "on")}
          className={`flex size-8 items-center justify-center rounded-full transition-[scale,background-color,color] duration-150 ease-out active:scale-90 ${listening ? "text-primary-foreground/80 pointer-fine:hover:bg-primary-foreground/15 pointer-fine:hover:text-primary-foreground" : "text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"}`}
        >
          {voice === "on" ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Close the assistant"
          title="Close"
          onClick={props.onClose}
          className={`flex size-8 items-center justify-center rounded-full transition-[scale,background-color,color] duration-150 ease-out active:scale-90 ${listening ? "text-primary-foreground/80 pointer-fine:hover:bg-primary-foreground/15 pointer-fine:hover:text-primary-foreground" : "text-muted-foreground pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"}`}
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div ref={scroller} aria-live="polite" className="min-h-28 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="text-lg font-semibold tracking-tight">Tell me about your shifts.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add one, say you can’t make it, add the hours you worked, or ask me to open something. English, Hinglish or Hindi — however you talk, it answers the same way.</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => props.onSend(example)}
                    disabled={phase === "thinking"}
                    className="rounded-full bg-card px-3 py-1.5 text-left text-sm shadow-card transition-[scale,background-color] duration-150 ease-out active:scale-[0.97] pointer-fine:hover:bg-raised"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary/12 px-3 py-2 text-sm">
                  {message.text}
                </li>
              ) : (
                <li key={message.id} className="max-w-[92%] text-sm">
                  <p className={message.failed ? "text-destructive-ink" : ""}>{message.text}</p>
                  {message.failed && message.retry && (
                    <button type="button" onClick={() => props.onSend(message.retry!)} className="mt-1 text-sm font-medium text-primary pointer-fine:hover:underline">
                      Try again
                    </button>
                  )}
                  {message.saved && (
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {message.undone ? (
                        "Undone"
                      ) : (
                        <>
                          <Check aria-hidden className="size-3.5 text-success" />
                          Saved
                          <button type="button" onClick={() => props.onUndo(message)} className="font-medium text-primary pointer-fine:hover:underline">
                            Undo
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
        {props.askToRemember && phase === "idle" && (
          // Asked once, after the first answer — when they've seen what there would be to keep
          <div role="group" aria-label="Remember our chats?" className="assistant-card mt-4 rounded-xl bg-card p-3.5 shadow-card">
            <p className="text-sm font-semibold">Remember our chats next time?</p>
            <p className="mt-1 text-xs text-pretty text-muted-foreground">
              I’d carry on where you stopped, on the web and your phone, and keep short notes so you needn’t repeat yourself. Kept 30 days after your last message; change it any time in Settings › Features.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="quiet" size="sm" onClick={() => props.onRemember(false)}>
                Not now
              </Button>
              <Button size="sm" onClick={() => props.onRemember(true)}>
                Remember
              </Button>
            </div>
          </div>
        )}
        {phase === "thinking" && (
          <p role="status" className="assistant-thinking mt-3 flex gap-1" aria-label="Thinking">
            <span className="size-1.5 rounded-full bg-faint" />
            <span className="size-1.5 rounded-full bg-faint" />
            <span className="size-1.5 rounded-full bg-faint" />
          </p>
        )}
      </div>

      {card.shown && (
        // The slot folds away under a card that is leaving, so the conversation takes the room back
        <div className="assistant-card-slot shrink-0" data-leaving={card.leaving || undefined}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3 pb-2">
              <ProposalCard key={card.key} proposal={card.shown} busy={saving} listening={listening} leaving={card.leaving} onSave={props.onSave} onDismiss={props.onDismissCard} />
            </div>
          </div>
        </div>
      )}

      <footer ref={footer} className="shrink-0 border-t border-border px-3 pt-2.5 pb-3">
        <div className="mb-2 flex items-center gap-2">
          <p className={`min-w-0 flex-1 text-xs ${listenError ? "text-destructive-ink" : "text-muted-foreground"}`}>{status}</p>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="assistant-input">
            Message
          </label>
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-card pr-1 pl-4 shadow-card focus-within:shadow-[0_0_0_2px_var(--primary)]">
            <input
              ref={input}
              id="assistant-input"
              value={draft}
              onChange={(event) => props.onDraft(event.target.value)}
              placeholder={listening ? "Listening — or type here" : "Type a message"}
              autoComplete="off"
              maxLength={500}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint md:text-sm"
            />
            {draft.trim() && (
              <button type="submit" aria-label="Send" disabled={phase === "thinking"} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[scale] duration-150 ease-out active:scale-90 disabled:opacity-45">
                <ArrowUp aria-hidden className="size-4" />
              </button>
            )}
          </div>
          {canListen && <MicButton phase={phase} listening={listening} disabled={false} onMic={props.onMic} onStopSpeaking={props.onStopSpeaking} />}
        </form>
      </footer>
    </section>
  );
}
