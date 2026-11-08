"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { confirmProposal, refreshAfterLostReply, sendToAssistant, transcribeRecording, type AssistantAction, type AssistantTurn, type AssistantPage, type HistoryLine, type Proposal, type Saved } from "@/lib/assistant";
import { clearShiftMissed } from "@/lib/missedShifts";
import { setPreference, usePreference } from "@/lib/preferences";
import { useUser } from "@/lib/session";
import { closeAllSheets, openNewShift, openSheet } from "@/lib/sheets";
import { deleteShift } from "@/lib/shifts";
import { AssistantPanel, type Message } from "./AssistantPanel";
import { closeAssistant, onAssistantOpenChange, useAssistantOpen } from "./assistantOpen";
import { loadConversation, saveConversation } from "./conversation";
import { canRecord, useRecorder } from "./recorder";
import { speak, stopSpeaking } from "./speech";

const PAGES: AssistantPage[] = ["home", "shifts", "calendar", "jobs", "timesheet", "sharing", "settings"];
// Hands-free listening turns itself off after this long with nothing said and nothing waiting
const SLEEP_AFTER_MS = 30_000;

type RequestError = { response?: { data?: { message?: string } | null } };
const errorText = (err: unknown) => (err as RequestError).response?.data?.message ?? "Couldn’t reach ShiftBuddy. Check your connection and try again.";
/** No answer at all (timeout, dropped connection): the request may still have done its work */
const isLost = (err: unknown) => !(err as RequestError).response;

/** What a Save on the card did, said the way the button said it */
const savedText = (saved: Saved) => {
  if (saved.type === "editShift") return "Shift changed.";
  if (saved.type === "removeShifts") return saved.count === 1 ? "Shift removed." : `${saved.count} shifts removed.`;
  if (saved.type === "markMissed") return "Marked as missed.";
  if (saved.type === "logHours") return saved.count === 1 ? "Hours saved." : `Hours saved for ${saved.count} shifts.`;
  if (saved.type === "addJob") return "Job added.";
  if (saved.type === "editJob") return "Job changed.";
  if (saved.type === "deleteJob") return "Job deleted.";
  if (saved.type === "restoreJob") return "Job is back.";
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
  const voice = usePreference("assistantVoice");
  const user = useUser();
  // Carries on where they stopped (this browser, this account, the last day)
  const [messages, setMessages] = useState<Message[]>(() => loadConversation(user.id));
  const [pending, setPending] = useState<Proposal | null>(null);
  const [phase, setPhase] = useState<"idle" | "thinking" | "speaking">("idle");
  const [handsFree, setHandsFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const host = useSyncExternalStore(open ? subscribeToDialogs : subscribeToNothing, open ? topDialog : noDialog, noDialog);

  const sendVoiceRef = useRef<(audio: Blob) => void>(() => {});
  // Every browser listens the same way: a recording that ShiftBuddy writes down in the
  // language it was spoken in (English, Hinglish or Hindi — no switch to set)
  const recorder = useRecorder({ onRecording: (audio) => sendVoiceRef.current(audio) });
  const { start: startRecording, stop: stopListening, error: listenError, recording: hearing } = recorder;

  // Read inside async flows, where state from the render that started them is stale
  const live = useRef({ messages, pending, handsFree, voice, listenError });
  useEffect(() => {
    live.current = { messages, pending, handsFree, voice, listenError };
  });
  const nextId = useRef(messages.reduce((highest, line) => Math.max(highest, line.id), 0) + 1);

  useEffect(() => {
    // A failure from an earlier visit is noise when they come back
    saveConversation(user.id, messages.filter((line) => !line.failed));
  }, [user.id, messages]);

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

  const startListening = useCallback(() => void startRecording(), [startRecording]);

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
      await say(turn.speech ?? turn.reply);
      resume();
    },
    [add, runAction, say, resume],
  );

  const failTurn = useCallback(
    (err: unknown, retry?: string, cardWaited = false) => {
      if (isLost(err) && cardWaited) {
        // A "yes" whose answer got lost may have saved: the card goes (it may be done), the lists refresh
        setPending(null);
        refreshAfterLostReply();
        add({ role: "assistant", text: "I didn’t hear back from ShiftBuddy, so that may have saved. Your calendar is up to date — have a look before asking again.", failed: true });
      } else {
        add({ role: "assistant", text: errorText(err), failed: true, retry });
      }
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
      // The card leaves as soon as they answer it; the reply brings the next one, or none
      const waiting = live.current.pending;
      setPending(null);
      add({ role: "user", text: message });
      setDraft("");
      try {
        await finishTurn(await sendToAssistant({ message, history, pending: waiting, page }));
      } catch (err) {
        // A refusal changed nothing, so the card comes back; a lost reply may have saved it
        if (!isLost(err)) setPending(waiting);
        failTurn(err, message, waiting !== null);
      }
    },
    [add, page, beginTurn, finishTurn, failTurn],
  );

  /** A recording: written down first (shown as theirs), then sent like a typed message */
  const sendVoice = useCallback(
    async (audio: Blob) => {
      beginTurn();
      let heard: string;
      try {
        heard = await transcribeRecording(audio);
      } catch (err) {
        // Nothing was sent to the assistant yet, so nothing can have saved
        add({ role: "assistant", text: errorText(err), failed: true });
        setHandsFree(false);
        setPhase("idle");
        return;
      }
      // Nothing clear was said: keep listening
      if (!heard) return resume();
      await send(heard);
    },
    [add, beginTurn, send, resume],
  );

  useEffect(() => {
    sendVoiceRef.current = (audio) => void sendVoice(audio);
  }, [sendVoice]);

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

  /** A clean slate: the conversation, the card and anything being said or heard */
  const startOver = () => {
    stopTalking();
    setPending(null);
    setMessages([]);
  };

  // Opening by a mic button starts the conversation; closing ends listening and speech
  useEffect(
    () =>
      onAssistantOpenChange((next) => {
        if (next.open && next.listen && canRecord()) startTalking();
        if (!next.open) stopTalking();
      }),
    [startTalking, stopTalking],
  );

  // Hands-free stops after a quiet stretch with nothing waiting: a forgotten open mic
  // shouldn't keep listening to the room
  useEffect(() => {
    if (!hearing || pending) return;
    const timer = setTimeout(stopTalking, SLEEP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hearing, pending, stopTalking]);

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
      listenError={listenError}
      canListen={canRecord()}
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
      onNewChat={startOver}
      onUndo={(message) => void undo(message)}
      onVoice={(next) => {
        if (next === "off") stopSpeaking();
        setPreference("assistantVoice", next);
      }}
      onClose={closeAssistant}
    />,
    host ?? document.body,
  );
}
