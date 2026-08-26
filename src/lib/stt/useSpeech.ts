"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typings for the Web Speech API (not in TS lib DOM by default). */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeech {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
}

export function useSpeech(lang: string): UseSpeech {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<(t: string) => void>(() => {});

  useEffect(() => {
    setSupported(Boolean(getCtor()));
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getCtor();
      if (!Ctor) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }
      onFinalRef.current = onFinal;
      setError(null);
      setInterim("");

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;

      rec.onresult = (e) => {
        let interimText = "";
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        setInterim(interimText);
        if (finalText) {
          setInterim("");
          onFinalRef.current(finalText.trim());
        }
      };
      rec.onerror = (ev) => {
        if (ev.error !== "no-speech" && ev.error !== "aborted") {
          setError(`Microphone error: ${ev.error}`);
        }
        setListening(false);
      };
      rec.onend = () => setListening(false);

      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        // start() can throw if already started; ignore.
      }
    },
    [lang]
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
