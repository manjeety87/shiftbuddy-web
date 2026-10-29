"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { confirmProposal, sendToAssistant, sendVoiceToAssistant, type AssistantAction, type AssistantTurn, type AssistantPage, type HistoryLine, type Proposal, type Saved } from "@/lib/assistant";
import { clearShiftMissed } from "@/lib/missedShifts";
import { setPreference, usePreference } from "@/lib/preferences";
import { closeAllSheets, openNewShift, openSheet } from "@/lib/sheets";
import { deleteShift } from "@/lib/shifts";
import { deleteTimeEntry } from "@/lib/timesheet";
import { AssistantPanel, type Message } from "./AssistantPanel";
import { closeAssistant, onAssistantOpenChange, useAssistantOpen } from "./assistantOpen";
import { canRecord, useRecorder } from "./recorder";
import { canListen, speak, stopSpeaking, useListening } from "./speech";

const PAGES: AssistantPage[] = ["home", "shifts", "calendar", "jobs", "timesheet", "sharing", "settings"];
// Hands-free listening turns itself off after this long with nothing said and nothing waiting
const SLEEP_AFTER_MS = 30_000;

const errorText = (err: unknown) => (err as { response?: { data?: { message?: string } | null } }).response?.data?.message ?? "Couldn’t reach ShiftBuddy. Check your connection and try again.";

/** What a Save on the card did, said the way the button said it */
const savedText = (saved: Saved) => {
  if (saved.type === "editShift") return "Shift changed.";
  if (saved.type === "removeShifts") return saved.count === 1 ? "Shift removed." : `${saved.count} shifts removed.`;
  if (saved.type === "markMissed") return "Marked as missed.";
  if (saved.type === "logHours") return "Hours added.";
  const added = saved.count === 1 ? "Shift added." : `${saved.count} shifts added.`;
  return saved.skipped ? `${added} ${saved.skipped} clashed with shifts you have and ${saved.skipped === 1 ? "was" : "were"} skipped.` : added;
};

// The assistant floats above the page and keeps working when it opens a panel (a
// shift's details). A panel is a modal <dialog>: everything outside it goes inert and
// under it. So the assistant moves inside the topmost open dialog while there is one.
// Watched only while the assistant is open: watching the page all the time re-rendered the
// shell in the middle of every page change. Removals count too — React takes a closed panel
// off the page before its cleanup closes the dialog.
const subscribeToDialogs = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { subtree: true, childList: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
};
const topDialog = () => {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return open.length ? open[open.length - 1] : null;
};
const subscribeToNothing = () => () => {};
const noDialog = () => null;

/**
 * The assistant: talk or type, and ShiftBuddy adds shifts, marks one missed, adds
 * hours or opens a place — anything that saves waits on a card for a yes. The
 * conversation lives here (in memory, this tab only) and is sent with each turn; the
 * backend owns every rule.
 */
export function Assistant() {
  const { open } = useAssistantOpen();
  const router = useRouter();
  const pathname = usePathname();
  const language = usePreference("assistantLanguage");
  const voice = usePreference("assistantVoice");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Proposal | null>(null);
  const [phase, setPhase] = useState<"idle" | "thinking" | "speaking">("idle");
  const [handsFree, setHandsFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const host = useSyncExternalStore(open ? subscribeToDialogs : subscribeToNothing, open ? topDialog : noDialog, noDialog);

  const sendRef = useRef<(text: string) => void>(() => {});
  const sendVoiceRef = useRef<(audio: Blob) => void>(() => {});
  const listening = useListening({ lang: language, onPhrase: (text) => sendRef.current(text) });
  const recorder = useRecorder({ onRecording: (audio) => sendVoiceRef.current(audio) });
  const { start: startBrowserListening, stop: stopBrowserListening } = listening;
  const { start: startRecording, stop: stopRecording } = recorder;
  // The browser's speech service when it has one that works; otherwise a recording that
  // ShiftBuddy writes down (Firefox, Brave, a Chrome that can't reach its speech service)
  const recorded = !canListen() || listening.error === "unavailable";
  const listenError = recorded ? recorder.error : listening.error;

  // Read inside async flows, where state from the render that started them is stale
  const live = useRef({ messages, pending, handsFree, voice, listenError, recorded });
  useEffect(() => {
    live.current = { messages, pending, handsFree, voice, listenError, recorded };
  });
  const nextId = useRef(1);
  const add = useCallback((message: Omit<Message, "id">) => setMessages((list) => [...list, { ...message, id: nextId.current++ }]), []);

  const page = PAGES.find((name) => pathname.startsWith(`/${name}`));

  const runAction = useCallback(
    (action: AssistantAction) => {
      if (action.type === "openPage") {
        closeAllSheets();
        router.push(`/${action.page}`);
      } else if (action.type === "openShift") openSheet({ kind: "shift", shiftId: action.shiftId });
      else if (action.type === "closePanels") closeAllSheets();
      else if (action.panel === "newShift") openNewShift();
      else if (action.panel === "newJob") openSheet({ kind: "job" });
      else if (action.panel === "addHours") openSheet({ kind: "timeEntry" });
      else openSheet({ kind: action.panel });
    },
    [router],
  );

  const startListening = useCallback(() => (live.current.recorded ? void startRecording() : startBrowserListening()), [startRecording, startBrowserListening]);
  const stopListening = useCallback(() => {
    stopBrowserListening();
    stopRecording();
  }, [stopBrowserListening, stopRecording]);

  /** After a reply: listening comes back on by itself in a hands-free conversation — not after a blocked microphone */
  const resume = useCallback(() => {
    setPhase("idle");
    if (live.current.handsFree && !live.current.listenError) startListening();
  }, [startListening]);

  const say = useCallback(
    async (text: string) => {
      if (live.current.voice !== "on") return;
      setPhase("speaking");
      await speak(text);
    },
    [],
  );

  /** Before a turn goes out: its own voice must not be heard as the next request */
  const beginTurn = useCallback((): HistoryLine[] => {
    stopListening();
    stopSpeaking();
    setPhase("thinking");
    return live.current.messages.filter((line) => !line.failed).map(({ role, text: said }) => ({ role, text: said }));
  }, [stopListening]);

  const finishTurn = useCallback(
    async (turn: AssistantTurn) => {
      add({ role: "assistant", text: turn.reply, saved: turn.saved ?? undefined });
      setPending(turn.pending);
      turn.actions.forEach(runAction);
      await say(turn.reply);
      resume();
    },
    [add, runAction, say, resume],
  );

  const failTurn = useCallback(
    (err: unknown, retry?: string) => {
      add({ role: "assistant", text: errorText(err), failed: true, retry });
      // A failing service isn't talked at in a loop: listening waits for a tap
      setHandsFree(false);
      setPhase("idle");
    },
    [add],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message) return;
      const history = beginTurn();
      add({ role: "user", text: message });
      setDraft("");
      try {
        await finishTurn(await sendToAssistant({ message, history, pending: live.current.pending, page }));
      } catch (err) {
        failTurn(err, message);
      }
    },
    [add, page, beginTurn, finishTurn, failTurn],
  );

  const sendVoice = useCallback(
    async (audio: Blob) => {
      const history = beginTurn();
      try {
        const turn = await sendVoiceToAssistant(audio, { history, pending: live.current.pending, page });
        // Nothing clear was said: keep listening
        if (!("reply" in turn)) return resume();
        add({ role: "user", text: turn.heard });
        await finishTurn(turn);
      } catch (err) {
        failTurn(err);
      }
    },
    [add, page, beginTurn, finishTurn, failTurn, resume],
  );

  useEffect(() => {
    sendRef.current = (text) => void send(text);
    sendVoiceRef.current = (audio) => void sendVoice(audio);
  }, [send, sendVoice]);

  // The browser's speech service turned out not to work: carry on by recording, without another tap
  useEffect(() => {
    if (listening.error === "unavailable" && live.current.handsFree && canRecord()) void startRecording();
  }, [listening.error, startRecording]);

  const startTalking = useCallback(() => {
    stopSpeaking();
    setHandsFree(true);
    setPhase("idle");
    startListening();
  }, [startListening]);

  const stopTalking = useCallback(() => {
    setHandsFree(false);
    stopListening();
    stopSpeaking();
    setPhase((current) => (current === "speaking" ? "idle" : current));
  }, [stopListening]);

  // Opening by a mic button starts the conversation; closing ends listening and speech
  useEffect(
    () =>
      onAssistantOpenChange((next) => {
        if (next.open && next.listen && (canListen() || canRecord())) startTalking();
        if (!next.open) stopTalking();
      }),
    [startTalking, stopTalking],
  );

  // Hands-free stops after a quiet stretch with nothing waiting: a forgotten open mic
  // shouldn't keep listening to the room
  const hearing = listening.listening || recorder.recording;
  useEffect(() => {
    if (!hearing || pending) return;
    const timer = setTimeout(stopTalking, SLEEP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hearing, listening.interim, pending, stopTalking]);

  const save = async () => {
    if (!pending) return;
    stopSpeaking();
    setSaving(true);
    try {
      const saved = await confirmProposal(pending);
      setPending(null);
      const text = savedText(saved);
      add({ role: "assistant", text, saved });
      await say(text);
      resume();
    } catch (err) {
      add({ role: "assistant", text: errorText(err), failed: true });
    } finally {
      setSaving(false);
    }
  };

  const undo = async (message: Message) => {
    const saved = message.saved;
    if (!saved) return;
    try {
      if (saved.undo) await confirmProposal(saved.undo);
      else if (saved.type === "addShifts") await Promise.all(saved.shiftIds.map(deleteShift));
      else if (saved.type === "markMissed") await clearShiftMissed(saved.shiftIds[0]);
      else if (saved.entryId) await deleteTimeEntry(saved.entryId);
      setMessages((list) => list.map((line) => (line.id === message.id ? { ...line, undone: true } : line)));
    } catch (err) {
      add({ role: "assistant", text: errorText(err), failed: true });
    }
  };

  if (!open) return null;

  return createPortal(
    <AssistantPanel
      // A new host remounts the panel; everything it shows lives up here
      key={host ? "in-dialog" : "page"}
      overDialog={host !== null}
      messages={messages}
      pending={pending}
      phase={phase}
      listening={hearing}
      heard={listening.interim}
      listenError={listenError}
      canListen={canListen() || canRecord()}
      pickLanguage={!recorded}
      language={language}
      voice={voice}
      draft={draft}
      saving={saving}
      onDraft={setDraft}
      onSend={(text) => void send(text)}
      onMic={() => (hearing ? stopTalking() : startTalking())}
      // Cutting the voice off ends `say`, and the turn carries on from there
      onStopSpeaking={stopSpeaking}
      onSave={() => void save()}
      onDismissCard={() => setPending(null)}
      onUndo={(message) => void undo(message)}
      onLanguage={(next) => setPreference("assistantLanguage", next)}
      onVoice={(next) => {
        if (next === "off") stopSpeaking();
        setPreference("assistantVoice", next);
      }}
      onClose={closeAssistant}
    />,
    host ?? document.body,
  );
}
