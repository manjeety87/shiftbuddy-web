"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToDialogs, type DialogButton, type DialogRequest } from "@/lib/dialog";
import { Button } from "./Button";

const EXIT_MS = 150;
/** A double-click on the button that asked would land its second click on the backdrop and answer "Cancel" */
const BACKDROP_ARMS_AFTER_MS = 300;

/**
 * Draws what `showAlert` asks for, one question at a time. A <dialog> opened last
 * sits above any open sheet. Never the browser's confirm()/alert().
 */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [shown, setShown] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  // The question on screen has been answered and is on its way out: a second press must not answer it again
  const answered = useRef(false);
  const openedAt = useRef(0);
  const current = queue[0];

  useEffect(() => subscribeToDialogs((request) => setQueue((waiting) => [...waiting, request])), []);

  useEffect(() => {
    const element = dialog.current;
    if (!current || !element) return;
    answered.current = false;
    openedAt.current = performance.now();
    element.showModal();
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      element.close();
    };
  }, [current]);

  if (!current) return null;

  const close = (button?: DialogButton) => {
    if (answered.current) return;
    answered.current = true;
    setShown(false);
    setTimeout(() => {
      setQueue((waiting) => waiting.slice(1));
      if (button) button.onPress?.();
      else current.options.onDismiss?.();
    }, EXIT_MS);
  };

  const cancelable = current.options.cancelable ?? true;
  const cancelButton = current.buttons.find((button) => button.style === "cancel");
  const dismiss = () => {
    if (cancelable) close(cancelButton);
  };

  return (
    <dialog
      ref={dialog}
      // It interrupts to ask something: a screen reader reads the title and the message as it opens
      role="alertdialog"
      aria-labelledby="dialog-title"
      aria-describedby={current.message ? "dialog-message" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent backdrop:bg-transparent"
    >
      <div
        aria-hidden
        // A press on the dimmed page must not pull focus off the dialog's buttons
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (performance.now() - openedAt.current > BACKDROP_ARMS_AFTER_MS) dismiss();
        }}
        className={`absolute inset-0 bg-black/35 transition-opacity duration-150 ease-out ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div
          className={`pointer-events-auto w-full max-w-sm surface p-5 shadow-modal transition-[opacity,scale] duration-150 ease-out ${shown ? "scale-100 opacity-100" : "scale-[0.96] opacity-0"}`}
        >
          <h2 id="dialog-title" className="text-base font-semibold text-balance">
            {current.title}
          </h2>
          {current.message && (
            <p id="dialog-message" className="mt-1.5 text-sm text-pretty whitespace-pre-line text-muted-foreground">{current.message}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2 max-sm:*:flex-1">
            {current.buttons.map((button, index) => {
              const isLast = index === current.buttons.length - 1;
              return (
                <Button
                  key={button.text}
                  variant={button.style === "destructive" ? "danger" : button.style === "cancel" || !isLast ? "secondary" : "primary"}
                  className={button.style === "destructive" ? "ring-1 ring-destructive/30" : ""}
                  onClick={() => close(button)}
                >
                  {button.text}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </dialog>
  );
}
