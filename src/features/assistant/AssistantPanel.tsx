"use client";

import { ArrowUp, Check, Maximize2, Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Spinner } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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

const LANGUAGES = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "हिन्दी" },
] as const;

const LISTEN_ERRORS: Record<ListenError, string> = {
  blocked: "The microphone is blocked. Allow it from the address bar, or type instead.",
  "no-mic": "No microphone found. Type instead.",
  offline: "Listening needs an internet connection. Type instead.",
  unavailable: "This browser can’t listen. Type instead, or open ShiftBuddy in Chrome, Edge or Safari.",
};

interface PanelProps {
  overDialog: boolean;
  messages: Message[];
  pending: Proposal | null;
  phase: Phase;
  listening: boolean;
  heard: string;
  listenError: ListenError | null;
  canListen: boolean;
  language: "en-IN" | "hi-IN";
  voice: "on" | "off";
  draft: string;
  saving: boolean;
  onDraft: (text: string) => void;
  onSend: (text: string) => void;
  onMic: () => void;
  onStopSpeaking: () => void;
  onSave: () => void;
  onDismissCard: () => void;
  onUndo: (message: Message) => void;
  onLanguage: (language: "en-IN" | "hi-IN") => void;
  onVoice: (voice: "on" | "off") => void;
  onClose: () => void;
}

/**
 * The microphone is the one bold thing here. Its halo follows the voice it hears,
 * frame by frame, so the person sees they're being heard before a word appears.
 */
function MicButton({ phase, listening, disabled, onMic, onStopSpeaking, size = "md" }: { phase: Phase; listening: boolean; disabled: boolean; onMic: () => void; onStopSpeaking: () => void; size?: "md" | "sm" }) {
  const button = useRef<HTMLButtonElement>(null);
  useMicLevel(listening, button);
  const speaking = phase === "speaking";
  const label = speaking ? "Stop speaking" : listening ? "Stop listening" : "Talk";

  return (
    <button
      ref={button}
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
  const { overDialog, messages, pending, phase, listening, heard, listenError, canListen, language, voice, draft, saving } = props;
  const [expanded, setExpanded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // The newest line, what's being heard, and the card stay in view
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, heard, phase, pending]);

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

  if (overDialog && !expanded) {
    return (
      <div role="region" aria-label="Assistant" onKeyDown={onKeyDown} className="assistant-pill frosted fixed top-3 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-card/85 py-1.5 pr-1.5 pl-1.5 shadow-pop backdrop-blur-xl backdrop-saturate-150">
        {canListen && <MicButton size="sm" phase={phase} listening={listening} disabled={false} onMic={props.onMic} onStopSpeaking={props.onStopSpeaking} />}
        <p aria-live="polite" className="max-w-80 min-w-0 truncate text-sm">
          {pending ? (listening ? "A card is waiting — say “yes”, or open it" : "A card is waiting") : heard || (phase === "idle" && lastReply ? lastReply.text : status)}
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
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">Assistant</h2>
        <button
          type="button"
          aria-label={voice === "on" ? "Stop reading replies aloud" : "Read replies aloud"}
          title={voice === "on" ? "Replies are read aloud" : "Replies are silent"}
          aria-pressed={voice === "on"}
          onClick={() => props.onVoice(voice === "on" ? "off" : "on")}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
        >
          {voice === "on" ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Close the assistant"
          title="Close"
          onClick={props.onClose}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-90 pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div ref={scroller} aria-live="polite" className="min-h-28 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="text-lg font-semibold tracking-tight">Tell me about your shifts.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add one, say you can’t make it, add the hours you worked, or ask me to open something. English or Hinglish, however you talk.</p>
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
        {heard && <p className="mt-3 text-right text-sm text-muted-foreground italic">{heard}</p>}
        {phase === "thinking" && (
          <p role="status" className="assistant-thinking mt-3 flex gap-1" aria-label="Thinking">
            <span className="size-1.5 rounded-full bg-faint" />
            <span className="size-1.5 rounded-full bg-faint" />
            <span className="size-1.5 rounded-full bg-faint" />
          </p>
        )}
      </div>

      {pending && (
        <div className="shrink-0 px-3 pb-2">
          <ProposalCard proposal={pending} busy={saving} listening={listening} onSave={props.onSave} onDismiss={props.onDismissCard} />
        </div>
      )}

      <footer className="shrink-0 border-t border-border px-3 pt-2.5 pb-3">
        <div className="mb-2 flex items-center gap-2">
          <p className={`min-w-0 flex-1 text-xs ${listenError ? "text-destructive-ink" : "text-muted-foreground"}`}>{status}</p>
          {canListen && <SegmentedControl label="Language I listen for" options={LANGUAGES} value={language} onChange={props.onLanguage} className="w-40 shrink-0 [&_label]:h-7! [&_label]:text-xs!" />}
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
