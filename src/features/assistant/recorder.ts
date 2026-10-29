"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListenError } from "./speech";

// When the browser has no speech service (Firefox, Brave, a Chrome that can't reach
// Google's), the assistant records instead and ShiftBuddy writes the words down — the
// same way the phone app works. Recording ends on its own once the person stops talking.

// Louder than this (dB) is speech — or, in a noisy room, this far over the room's own level
const SPEECH_DB = -42;
const OVER_ROOM_DB = 12;
// This much quiet after speech ends the request
const SILENCE_MS = 1300;
// A cough or a click isn't a request
const MIN_SPEECH_MS = 400;
// A request is a sentence or two; a forgotten open mic is sent before it runs long
const MAX_MS = 45_000;
const POLL_MS = 100;
// 16 kHz mono is what speech recognition works at, and keeps a request small
const SAMPLE_RATE = 16_000;

export const canRecord = () => typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * The recording as 16-bit WAV. Browsers record WebM (Chrome, Firefox) or MP4 (Safari);
 * Gemini's audio list has neither WebM nor every MP4 flavour, but every browser can
 * decode its own recording, and WAV is read everywhere.
 */
const toWav = async (recording: Blob) => {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await recording.arrayBuffer()).finally(() => void context.close());
  // Rendering into one channel at 16 kHz mixes down and resamples in one step
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return new Blob([view], { type: "audio/wav" });
};

/**
 * One spoken request at a time: `start` opens the microphone, and once something was
 * said and a pause follows, `onRecording` gets it as WAV. `stop` drops what was heard.
 */
export function useRecorder({ onRecording }: { onRecording: (audio: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<ListenError | null>(null);
  const session = useRef<{ end: (send: boolean) => void } | null>(null);
  const latestRecording = useRef(onRecording);
  useEffect(() => {
    latestRecording.current = onRecording;
  });

  const stop = useCallback(() => session.current?.end(false), []);

  const start = useCallback(async () => {
    if (!canRecord()) {
      setError("unavailable");
      return;
    }
    session.current?.end(false);
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      setError((err as DOMException).name === "NotFoundError" ? "no-mic" : "blocked");
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();
    let speechStartedAt = 0;
    let lastSpeechAt = 0;
    let room = -60;
    let send = false;

    const current = {
      end: (keep: boolean) => {
        if (session.current !== current) return;
        session.current = null;
        send = keep;
        clearInterval(timer);
        setRecording(false);
        if (recorder.state !== "inactive") recorder.stop();
      },
    };

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      if (!send || chunks.length === 0) return;
      toWav(new Blob(chunks, { type: recorder.mimeType }))
        .then((wav) => latestRecording.current(wav))
        .catch(() => setError("unavailable"));
    };

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-8);
      const now = performance.now();
      if (level > Math.max(SPEECH_DB, room + OVER_ROOM_DB)) {
        speechStartedAt ||= now;
        lastSpeechAt = now;
      } else {
        // The room's level, learned from the quiet between words
        room += (level - room) * 0.05;
      }
      const spoke = speechStartedAt > 0 && lastSpeechAt - speechStartedAt >= MIN_SPEECH_MS;
      if (spoke && now - lastSpeechAt > SILENCE_MS) current.end(true);
      else if (speechStartedAt && !spoke && now - lastSpeechAt > SILENCE_MS) speechStartedAt = 0;
      else if (now - startedAt > MAX_MS) current.end(spoke);
    }, POLL_MS);

    session.current = current;
    recorder.start();
    setRecording(true);
  }, []);

  useEffect(() => stop, [stop]);

  return { recording, error, start, stop };
}
