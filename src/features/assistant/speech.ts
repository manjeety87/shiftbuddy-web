"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The browser's own speech services (Web Speech API): free, no audio reaches our
// backend. Chrome and Edge send the audio to their speech service; Safari does it
// on the device; Firefox has no recognition at all, so the assistant is typed there.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

const recognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

export const canListen = () => recognitionConstructor() !== null;

export type ListenError = "blocked" | "no-mic" | "offline" | "unavailable";

// A finished phrase waits this long for a second one ("Tuesday… 9 to 5") before it is sent
const PHRASE_GAP_MS = 650;
// Chrome ends a session after a few silent seconds; it is restarted, but a session that
// keeps dying at once is a broken service, not silence — stop instead of looping.
const RESTART_DELAY_MS = 150;
const QUICK_END_MS = 1000;
const MAX_QUICK_ENDS = 3;

/**
 * Listening that stays on until stopped: Chrome's sessions end on their own after a
 * pause, so each end starts the next one. `onPhrase` gets each finished thing said;
 * `interim` is what is being heard right now, for the screen.
 */
export function useListening({ lang, onPhrase }: { lang: string; onPhrase: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<ListenError | null>(null);
  const wanted = useRef(false);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const gapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestPhrase = useRef(onPhrase);
  useEffect(() => {
    latestPhrase.current = onPhrase;
  });

  const flush = useCallback(() => {
    clearTimeout(gapTimer.current);
    const text = heard.current.trim();
    heard.current = "";
    setInterim("");
    if (text) latestPhrase.current(text);
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    clearTimeout(gapTimer.current);
    heard.current = "";
    setInterim("");
    setListening(false);
    recognition.current?.abort();
    recognition.current = null;
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError("unavailable");
      return;
    }
    recognition.current?.abort();
    wanted.current = true;
    setError(null);
    let quickEnds = 0;

    const open = () => {
      const session = new Constructor();
      const openedAt = Date.now();
      session.lang = lang;
      session.continuous = true;
      session.interimResults = true;
      session.onresult = (event) => {
        let live = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          if (result.isFinal) heard.current = `${heard.current} ${result[0].transcript}`;
          else live += result[0].transcript;
        }
        setInterim(`${heard.current} ${live}`.trim());
        clearTimeout(gapTimer.current);
        // Only a finished phrase with nothing more coming is sent
        if (!live.trim() && heard.current.trim()) gapTimer.current = setTimeout(flush, PHRASE_GAP_MS);
      };
      session.onerror = ({ error: code }) => {
        // "no-speech" and "aborted" are ordinary: silence, or our own stop
        if (code === "not-allowed" || code === "service-not-allowed") setError("blocked");
        else if (code === "audio-capture") setError("no-mic");
        // Online and still "network": the browser has the API but no speech service behind it (Brave)
        else if (code === "network") setError(navigator.onLine ? "unavailable" : "offline");
        else return;
        wanted.current = false;
      };
      session.onend = () => {
        if (recognition.current !== session) return;
        if (!wanted.current) {
          setListening(false);
          return;
        }
        quickEnds = Date.now() - openedAt < QUICK_END_MS ? quickEnds + 1 : 0;
        if (quickEnds >= MAX_QUICK_ENDS) {
          wanted.current = false;
          setError("unavailable");
          setListening(false);
          return;
        }
        setTimeout(() => {
          if (wanted.current && recognition.current === session) open();
        }, RESTART_DELAY_MS);
      };
      recognition.current = session;
      try {
        session.start();
        setListening(true);
      } catch {
        // start() throws if a session is somehow still running; the next end retries
      }
    };
    open();
  }, [lang, flush]);

  // A new language takes effect on the next session
  useEffect(() => {
    if (!wanted.current) return;
    start();
  }, [lang, start]);

  useEffect(() => stop, [stop]);

  return { listening, interim, error, start, stop };
}

// ---------------------------------------------------------------------------

const voiceFor = (lang: string) => {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split("-")[0];
  return voices.find((voice) => voice.lang === lang) ?? voices.find((voice) => voice.lang.replace("_", "-").startsWith(base)) ?? null;
};

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Devanagari is read by a Hindi voice; English and Hinglish in Roman letters by an Indian-English one. */
export const voiceLanguageOf = (text: string) => (/[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN");

// Chrome loads its voice list after the page; asking once early has it ready
if (canSpeak()) window.speechSynthesis.getVoices();

/** Reads `text` aloud; resolves when it's done or cut off. */
export const speak = (text: string) =>
  new Promise<void>((resolve) => {
    if (!canSpeak() || !text.trim()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLanguageOf(text);
    utterance.voice = voiceFor(utterance.lang);
    utterance.rate = 1.05;
    // Chrome sometimes never fires "end" (a voice that failed to load): don't wait forever
    const giveUp = setTimeout(resolve, 3000 + text.length * 90);
    const done = () => {
      clearTimeout(giveUp);
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  });

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};

// ---------------------------------------------------------------------------

/**
 * How loud the microphone is while listening, 0–1, written straight to a CSS
 * variable on `target` each frame (no React render per frame). The speech service
 * doesn't report levels, so this opens its own reading of the same microphone.
 */
export function useMicLevel(active: boolean, target: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = target.current;
    if (!active || !element || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          // Rise fast, fall slowly — a voice reads as a voice, not as flicker
          smooth = level > smooth ? smooth + (level - smooth) * 0.5 : smooth + (level - smooth) * 0.12;
          element.style.setProperty("--level", smooth.toFixed(3));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        // No level meter; listening itself reports a blocked microphone
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      element.style.setProperty("--level", "0");
    };
  }, [active, target]);
}
