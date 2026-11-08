"use client";

import { useEffect } from "react";

// The browser's own voices read the replies (free, nothing leaves the device). Listening
// is `recorder.ts`: ShiftBuddy writes the words down, in whatever language was spoken.

/** Why the microphone can't be used */
export type ListenError = "blocked" | "no-mic" | "unavailable";

/**
 * The best voice this browser has for a language. Neural voices sound like a person
 * (Edge's "Natural" ones, Chrome's "Google" ones); the old system voices sound like a
 * machine, so they lose to any neural voice, whatever its region.
 */
const voiceFor = (lang: string) => {
  const base = lang.split("-")[0];
  const score = (voice: SpeechSynthesisVoice) => {
    const voiceLang = voice.lang.replace("_", "-");
    if (!voiceLang.startsWith(base)) return -1;
    let points = 0;
    if (/natural|neural/i.test(voice.name)) points += 4;
    if (/google/i.test(voice.name)) points += 3;
    if (!voice.localService) points += 1;
    if (voiceLang === lang) points += 2;
    return points;
  };
  let best: SpeechSynthesisVoice | null = null;
  for (const voice of window.speechSynthesis.getVoices()) if (score(voice) >= 0 && (!best || score(voice) > score(best))) best = voice;
  return best;
};

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Devanagari (Hindi, and Hinglish replies' `speech`) is read by a Hindi voice; everything else by an English one. */
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
 * variable on each of `targets` each frame (no React render per frame). Set on the
 * few elements that move rather than on a parent, so the conversation in between
 * isn't restyled every frame. The speech service doesn't report levels, so this
 * opens its own reading of the same microphone. `targets` must be a stable array.
 */
export function useMicLevel(active: boolean, targets: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    const elements = targets.map((target) => target.current).filter((element): element is HTMLElement => element !== null);
    if (!active || elements.length === 0 || !navigator.mediaDevices?.getUserMedia) return;
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
          for (const element of elements) element.style.setProperty("--level", smooth.toFixed(3));
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
      for (const element of elements) element.style.setProperty("--level", "0");
    };
  }, [active, targets]);
}
