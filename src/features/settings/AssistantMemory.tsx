"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteAssistantNote, forgetAssistantMemory, getAssistantMemory } from "@/lib/assistant";
import { showAlert } from "@/lib/dialog";
import { errorMessage } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useFetch } from "@/lib/useFetch";

/**
 * Under the Remember assistant chats switch, while it's on: what the assistant noted
 * (each can go), and one button that deletes every kept line and note.
 */
export function AssistantMemory() {
  const { data, isLoading, error, refetch } = useFetch(getAssistantMemory, []);
  const [busy, setBusy] = useState<string | null>(null);

  const removeNote = async (noteId: string) => {
    setBusy(noteId);
    try {
      await deleteAssistantNote(noteId);
      await refetch();
    } catch (failure) {
      notify.error("Couldn’t delete that note", { description: errorMessage(failure) });
    } finally {
      setBusy(null);
    }
  };

  const forgetAll = () =>
    showAlert("Delete chats and notes?", "The assistant forgets your conversation and everything it noted, on the web and your phone. Remembering stays on for new chats.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("all");
          try {
            await forgetAssistantMemory();
            await refetch();
            notify.success("Chats and notes deleted");
          } catch (failure) {
            notify.error("Couldn’t delete them", { description: errorMessage(failure) });
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  if (isLoading) return <p className="px-9 py-3 text-xs text-muted-foreground">Loading what the assistant kept…</p>;
  if (error || !data) return <p className="px-9 py-3 text-xs text-muted-foreground">Couldn’t load what the assistant kept.</p>;

  const kept = data.messages.length;
  return (
    <div className="pr-4 pb-3.5 pl-9">
      <p className="text-xs font-medium text-muted-foreground">{data.notes.length === 0 ? "No notes yet — tell the assistant something to remember." : "Notes"}</p>
      {data.notes.length > 0 && (
        <ul className="mt-1.5 divide-y divide-border rounded-lg bg-card shadow-card">
          {data.notes.map((note) => (
            <li key={note.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
              <span className="min-w-0 flex-1 text-sm">{note.text}</span>
              <button
                type="button"
                aria-label={`Delete note: ${note.text}`}
                title="Delete note"
                disabled={busy !== null}
                onClick={() => void removeNote(note.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-90 disabled:opacity-45 pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{kept === 0 ? "No conversation kept." : `${kept} ${kept === 1 ? "line" : "lines"} of conversation kept.`}</p>
        <Button variant="danger" size="sm" busy={busy === "all"} disabled={(kept === 0 && data.notes.length === 0) || busy !== null} onClick={forgetAll}>
          Delete chats & notes
        </Button>
      </div>
    </div>
  );
}
