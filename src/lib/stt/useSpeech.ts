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
  onstart: (() => void) | null;
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

export type PermissionState = "unknown" | "granted" | "denied" | "prompt";

export interface UseSpeechOptions {
  lang: string;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}

export interface UseSpeech {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  permission: PermissionState;
  /** Live microphone loudness 0..1 (for the "it can hear you" indicator). */
  level: number;
  /** Turn the mic on (continuous, hands-free). Requests permission first. */
  start: () => Promise<void>;
  /** Turn the mic off completely. */
  stop: () => void;
  /**
   * Temporarily ignore recognised speech WITHOUT tearing down the mic. Used to
   * suppress the assistant's own text-to-speech from being captured as input
   * (echo) while it is talking, so answers spoken afterwards still register.
   */
  setMuted: (muted: boolean) => void;
}

/**
 * Continuous, hands-free speech recognition.
 *
 * - Explicitly requests microphone permission via getUserMedia so the browser
 *   reliably shows the permission prompt.
 * - Keeps listening across pauses by auto-restarting recognition until the
 *   caller explicitly stops it.
 */
export function useSpeech({ lang, onFinal, onInterim }: UseSpeechOptions): UseSpeech {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [level, setLevel] = useState(0);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(false);
  const listeningRef = useRef(false);
  // When true, recognised speech is ignored (e.g. while TTS is speaking) so the
  // assistant doesn't hear its own voice.
  const mutedRef = useRef(false);
  const langRef = useRef(lang);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);

  // Audio-level metering.
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const networkFailsRef = useRef(0);
  const stopMeteringRef = useRef<(() => void) | null>(null);

  // Gemini STT fallback (for browsers where Web Speech can't reach Google,
  // e.g. Brave). Uses MediaRecorder + /api/transcribe with simple VAD.
  const modeRef = useRef<"webspeech" | "gemini">("webspeech");
  const geminiAvailableRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const hadSpeechRef = useRef(false);
  const lastVoiceRef = useRef(0);
  const segStartRef = useRef(0);
  const vadRef = useRef<((lvl: number) => void) | null>(null);
  const startGeminiModeRef = useRef<() => void>(() => {});

  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
    langRef.current = lang;
  }, [onFinal, onInterim, lang]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    setSupported(Boolean(getCtor()));
    // Detect whether a server-side Gemini transcription fallback exists, so we
    // can support browsers without a working Web Speech API.
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { gemini?: boolean }) => {
        geminiAvailableRef.current = Boolean(d.gemini);
        if (d.gemini) setSupported(true);
      })
      .catch(() => {});
    // Best-effort read of current permission state.
    const nav = navigator as Navigator & {
      permissions?: {
        query: (d: { name: string }) => Promise<{
          state: string;
          onchange: (() => void) | null;
        }>;
      };
    };
    nav.permissions
      ?.query({ name: "microphone" })
      .then((status) => {
        setPermission(status.state as PermissionState);
        status.onchange = () =>
          setPermission(status.state as PermissionState);
      })
      .catch(() => {});
  }, []);

  const buildRecognition = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onresult = (e) => {
      networkFailsRef.current = 0; // a successful result clears network errors
      if (mutedRef.current) {
        // Ignore anything captured while the assistant is speaking (echo).
        setInterim("");
        return;
      }
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      onInterimRef.current?.(interimText);
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current(finalText.trim());
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setPermission("denied");
        setError(
          "Microphone permission was blocked. Allow it from the address bar and try again."
        );
        enabledRef.current = false;
        setListening(false);
        stopMeteringRef.current?.();
      } else if (ev.error === "network") {
        // The Web Speech service (Google cloud) is unreachable. In Brave/
        // embedded browsers this is persistent, so switch to the Gemini
        // recorder fallback when a key is available. In Chrome it's usually a
        // transient blip (e.g. right after TTS), so we KEEP listening and let
        // onend auto-restart rather than killing the mic.
        networkFailsRef.current += 1;
        if (geminiAvailableRef.current && networkFailsRef.current >= 2) {
          try {
            recRef.current?.abort();
          } catch {
            /* ignore */
          }
          startGeminiModeRef.current();
        } else if (!geminiAvailableRef.current && networkFailsRef.current >= 3) {
          // Non-fatal: surface guidance but stay enabled so the mic recovers.
          setError(
            'Speech service had trouble connecting ("network"). Retrying… If it persists, use Google Chrome or add a GEMINI_API_KEY, or type below.'
          );
        }
        // Do not disable: onend will auto-restart recognition.
      } else if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setError(`Microphone error: ${ev.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      // Auto-restart so listening is continuous until explicitly stopped —
      // but not if we've switched to the Gemini recorder fallback.
      if (enabledRef.current && modeRef.current === "webspeech") {
        try {
          rec.start();
        } catch {
          // start() can throw if called too quickly after end; retry shortly so
          // the mic reliably resumes (e.g. after the result is spoken aloud).
          setTimeout(() => {
            if (enabledRef.current && modeRef.current === "webspeech") {
              try {
                rec.start();
              } catch {
                /* ignore */
              }
            }
          }, 400);
        }
      }
    };
    return rec;
  }, []);

  // Watchdog: if we're supposed to be listening (Web Speech mode) but the
  // recognition has silently died, rebuild and restart it. Keeps the mic
  // "always on" without the user having to tap again.
  useEffect(() => {
    const iv = setInterval(() => {
      if (
        enabledRef.current &&
        modeRef.current === "webspeech" &&
        !listeningRef.current
      ) {
        const rec = buildRecognition();
        if (rec) {
          recRef.current = rec;
          try {
            rec.start();
          } catch {
            /* will retry on next tick */
          }
        }
      }
    }, 3500);
    return () => clearInterval(iv);
  }, [buildRecognition]);

  const startMetering = useCallback((stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Amplify and clamp for a lively but bounded indicator.
        const lvl = Math.min(1, rms * 3.2);
        setLevel(lvl);
        vadRef.current?.(lvl);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* metering is best-effort */
    }
  }, []);

  const stopMetering = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);
  stopMeteringRef.current = stopMetering;

  // --- Gemini recorder-mode fallback --------------------------------------
  const pickMimeType = useCallback((): string | undefined => {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t));
  }, []);

  const sendForTranscription = useCallback(async (blob: Blob) => {
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const s = String(reader.result || "");
          resolve(s.includes(",") ? s.split(",")[1] : s);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: b64,
          mimeType: blob.type || "audio/webm",
          lang: langRef.current,
        }),
      });
      if (!res.ok) {
        // Make server-side failures visible (e.g. missing key -> 503) so Brave
        // users aren't left with a silent, non-working mic.
        if (res.status === 503) {
          setError(
            "Voice fallback isn’t enabled on the server (no GEMINI_API_KEY). Add it in Vercel and redeploy, or use Chrome."
          );
        } else {
          setError(`Transcription failed (${res.status}). Please try again.`);
        }
        return;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text || "").trim();
      // Drop transcripts captured while muted (assistant was speaking).
      if (text && !mutedRef.current) {
        setError(null);
        setInterim("");
        onFinalRef.current(text);
      }
    } catch {
      /* transient; next segment will retry */
    }
  }, []);

  const startRecorderSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    let mr: MediaRecorder;
    const mime = pickMimeType();
    try {
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      return;
    }
    recorderRef.current = mr;
    chunksRef.current = [];
    hadSpeechRef.current = false;
    segStartRef.current = performance.now();
    lastVoiceRef.current = performance.now();
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const chunks = chunksRef.current;
      if (hadSpeechRef.current && chunks.length > 0) {
        void sendForTranscription(
          new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" })
        );
      }
      // Immediately start the next segment so listening stays continuous.
      if (enabledRef.current && modeRef.current === "gemini") {
        startRecorderSegment();
      }
    };
    try {
      mr.start();
      setListening(true);
    } catch {
      /* ignore */
    }
  }, [pickMimeType, sendForTranscription]);

  // Voice-activity detection: end a segment on a pause after speech.
  vadRef.current = (lvl: number) => {
    if (modeRef.current !== "gemini") return;
    const now = performance.now();
    if (lvl > 0.06) {
      hadSpeechRef.current = true;
      lastVoiceRef.current = now;
    }
    const mr = recorderRef.current;
    if (!mr || mr.state !== "recording") return;
    const dur = now - segStartRef.current;
    const silence = now - lastVoiceRef.current;
    if ((hadSpeechRef.current && silence > 900 && dur > 700) || dur > 12000) {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const startGeminiMode = useCallback(() => {
    modeRef.current = "gemini";
    enabledRef.current = true;
    setError(null);
    setListening(true);
    startRecorderSegment();
  }, [startRecorderSegment]);
  startGeminiModeRef.current = startGeminiMode;

  const start = useCallback(async () => {
    const hasWebSpeech = Boolean(getCtor());
    if (!hasWebSpeech && !geminiAvailableRef.current) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    setError(null);

    // Explicitly prompt for mic permission and keep the stream for metering.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");
      startMetering(stream);
    } catch {
      setPermission("denied");
      setError(
        "Microphone access is blocked. Click the camera/lock icon in the address bar, allow the Microphone, then reload."
      );
      return;
    }

    enabledRef.current = true;
    networkFailsRef.current = 0;

    // Brave ships webkitSpeechRecognition but blocks Google's speech backend,
    // so Web Speech always fails with "network". Detect Brave and go straight
    // to the Gemini recorder fallback (when a key is available).
    let isBrave = false;
    try {
      const b = (navigator as unknown as {
        brave?: { isBrave?: () => Promise<boolean> };
      }).brave;
      if (b?.isBrave) isBrave = await b.isBrave();
    } catch {
      /* ignore */
    }

    const preferGemini =
      geminiAvailableRef.current && (!hasWebSpeech || isBrave);

    // Prefer Web Speech (instant, free). Fall back to Gemini recorder mode when
    // Web Speech isn't available/reliable (e.g. Brave).
    if (preferGemini) {
      startGeminiMode();
    } else if (hasWebSpeech) {
      modeRef.current = "webspeech";
      const rec = buildRecognition();
      if (!rec) return;
      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        /* already started */
      }
    } else {
      startGeminiMode();
    }
  }, [buildRecognition, startGeminiMode]);

  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
    if (m) setInterim("");
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    setListening(false);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    try {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    } catch {
      /* ignore */
    }
    stopMetering();
  }, [stopMetering]);

  useEffect(
    () => () => {
      enabledRef.current = false;
      recRef.current?.abort();
      try {
        if (recorderRef.current?.state === "recording")
          recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      stopMetering();
    },
    [stopMetering]
  );

  return {
    supported,
    listening,
    interim,
    error,
    permission,
    level,
    start,
    stop,
    setMuted,
  };
}
