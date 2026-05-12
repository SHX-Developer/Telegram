"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "encoding" | "error";

export interface VoiceRecording {
  dataUrl: string;
  durationSec: number;
  mimeType: string;
}

/** Возвращает первый поддерживаемый MIME для MediaRecorder, или null. */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Не удалось прочитать аудио"));
    r.readAsDataURL(blob);
  });
}

const MAX_DURATION_SEC = 120; // 2 минуты — лимит на одно сообщение
const MAX_SIZE_BYTES = 4_500_000; // 4.5 МБ запас под лимит express.json (5mb)

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const resolveRef = useRef<((r: VoiceRecording | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    cancelledRef.current = false;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Запись звука не поддерживается в этом браузере");
      setState("error");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("Браузер не поддерживает запись аудио");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        cleanup();
        if (cancelledRef.current) {
          setState("idle");
          setElapsedMs(0);
          resolveRef.current?.(null);
          resolveRef.current = null;
          return;
        }
        if (blob.size === 0) {
          setState("idle");
          setElapsedMs(0);
          resolveRef.current?.(null);
          resolveRef.current = null;
          return;
        }
        if (blob.size > MAX_SIZE_BYTES) {
          setError("Запись слишком длинная для отправки");
          setState("error");
          resolveRef.current?.(null);
          resolveRef.current = null;
          return;
        }
        setState("encoding");
        try {
          const dataUrl = await blobToDataUrl(blob);
          setState("idle");
          setElapsedMs(0);
          resolveRef.current?.({ dataUrl, durationSec, mimeType });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ошибка кодирования");
          setState("error");
          resolveRef.current?.(null);
        } finally {
          resolveRef.current = null;
        }
      };

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      tickerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsedMs(ms);
        if (ms / 1000 >= MAX_DURATION_SEC) {
          recorderRef.current?.stop();
        }
      }, 200);

      rec.start();
      setState("recording");
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : "Нет доступа к микрофону");
      setState("error");
    }
  }, [cleanup]);

  const stopAndGet = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      cancelledRef.current = false;
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    } else {
      cleanup();
      setState("idle");
      setElapsedMs(0);
    }
  }, [cleanup]);

  return {
    state,
    elapsedMs,
    elapsedSec: Math.floor(elapsedMs / 1000),
    error,
    start,
    stopAndGet,
    cancel,
    MAX_DURATION_SEC,
  };
}
