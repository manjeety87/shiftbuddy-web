"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { showAlert } from "@/lib/dialog";
import { Button } from "./Button";

const EXIT_MS = 220;

export interface SheetHandle {
  /** Close without asking — after a save or delete went through. */
  dismiss: () => void;
}

interface SheetProps {
  title: string;
  /** Called once the panel has left the screen. */
  onClose: () => void;
  ref?: Ref<SheetHandle>;
  /** Unsaved changes: Cancel, Esc and a click outside ask "Discard changes?" first */
  isDirty?: boolean;
  /** The one primary action (forms). Without it the panel is read-only and shows Done. */
  action?: { label?: string; onClick: () => void; busy?: boolean; disabled?: boolean };
  /** Multi-step flows put their own main button in the content; the footer keeps only Cancel */
  cancelOnly?: boolean;
  /** The left side of the footer — where a form's "Delete" lives, away from Save */
  footerStart?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/**
 * A panel over the page. With a pointer it is a window in the middle of the page
 * (title and close on top, Cancel · Save bottom right — where a desktop puts
 * them); on a phone it rises from the bottom edge and leaves the same way. Built
 * on <dialog>, so focus stays inside, the page behind is inert and Esc works.
 */
export function Sheet({ title, onClose, ref, isDirty = false, action, cancelOnly = false, footerStart, wide = false, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    // Next frame, so the browser paints the starting position before moving
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      element.close();
    };
  }, []);

  const dismiss = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setShown(false);
    setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

  const requestClose = useCallback(() => {
    if (!isDirty) return dismiss();
    showAlert("Discard changes?", "What you’ve entered won’t be saved.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: dismiss },
    ]);
  }, [isDirty, dismiss]);

  const isReadOnly = !action && !cancelOnly;

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      // Esc: ours to answer, so unsaved work gets its question
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent backdrop:bg-transparent"
    >
      {/* Dim to focus: this is a task, the page waits */}
      <div aria-hidden onClick={requestClose} className={`absolute inset-0 bg-black/35 transition-opacity ease-out ${shown ? "opacity-100 duration-300" : "opacity-0 duration-200"}`} />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center md:items-center md:p-6">
        <div
          className={`modal-panel pointer-events-auto flex max-h-[calc(100dvh-2.5rem)] min-h-[50dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-background shadow-modal md:max-h-[min(47rem,100%)] md:min-h-0 md:rounded-2xl ${
            wide ? "md:w-[min(52rem,100%)]" : "md:w-[min(33rem,100%)]"
          } ${shown ? "modal-panel-shown" : ""}`}
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border pr-2.5 pl-5 md:h-13">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color,color] duration-150 ease-out active:scale-90 md:size-7 pointer-fine:hover:bg-hover pointer-fine:hover:text-foreground"
            >
              <X aria-hidden className="size-4.5 md:size-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

          <footer className="flex shrink-0 items-center gap-2 border-t border-border bg-card/60 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">{footerStart}</div>
            {isReadOnly ? (
              <Button onClick={dismiss}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={requestClose}>
                  Cancel
                </Button>
                {action && (
                  <Button onClick={action.onClick} busy={action.busy} disabled={action.disabled}>
                    {action.label ?? "Save"}
                  </Button>
                )}
              </>
            )}
          </footer>
        </div>
      </div>
    </dialog>
  );
}
