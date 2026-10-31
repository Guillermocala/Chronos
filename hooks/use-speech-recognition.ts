"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Tipos mínimos de la Web Speech API (no vienen en lib.dom de TypeScript).
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative; length: number };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

/** Soporte del navegador, sin errores de hidratación (en el servidor: false). */
export function useSpeechSupported() {
  return useSyncExternalStore(noop, () => getCtor() !== null, () => false);
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Permiso de micrófono denegado. Actívalo en la configuración del navegador.",
  "service-not-allowed": "El navegador no permite el reconocimiento de voz aquí.",
  "no-speech": "No se escuchó nada. Intenta de nuevo, más cerca del micrófono.",
  "audio-capture": "No se encontró un micrófono.",
  network: "El reconocimiento de voz necesita conexión a internet.",
};

export type SpeechStatus = "idle" | "listening" | "error";

/**
 * Dictado con la Web Speech API (es-CO). El texto final se acumula en
 * `transcript`; `interim` es lo que se está reconociendo en este momento.
 * El audio lo procesa el navegador (Google o Apple), nunca nuestro servidor.
 */
export function useSpeechRecognition({ lang = "es-CO" }: { lang?: string } = {}) {
  const supported = useSpeechSupported();
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    recognition.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else partial += result[0].transcript;
      }
      // Cada resultado final es una pausa: se separa con punto para que el
      // normalizador la trate como un ítem distinto.
      if (finalText.trim()) {
        setTranscript((prev) => joinSentence(prev, finalText.trim()));
      }
      setInterim(partial);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      setError(ERROR_MESSAGES[e.error] ?? "No se pudo usar el reconocimiento de voz.");
      setStatus("error");
    };
    rec.onend = () => {
      setInterim("");
      setStatus((s) => (s === "listening" ? "idle" : s));
      if (recognition.current === rec) recognition.current = null;
    };
    recognition.current = rec;
    setError(null);
    setStatus("listening");
    try {
      rec.start();
    } catch {
      setError("No se pudo iniciar el micrófono.");
      setStatus("error");
    }
  }, [lang]);

  // Al desmontar (cerrar el panel) se apaga el micrófono.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, status, transcript, setTranscript, interim, error, start, stop };
}

function joinSentence(prev: string, next: string) {
  const base = prev.trimEnd();
  if (!base) return next;
  return /[.;:!?]$/.test(base) ? `${base} ${next}` : `${base}. ${next}`;
}
