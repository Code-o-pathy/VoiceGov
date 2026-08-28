"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceGov } from "@/lib/voicegov/useVoiceGov";
import { useSpeech } from "@/lib/stt/useSpeech";
import { VoiceOrb, type OrbMode } from "./VoiceOrb";
import { ActionTimeline } from "./ActionTimeline";
import { ConfirmationDialog } from "./ConfirmationDialog";

const SUGGESTIONS = [
  "Mujhe apna refund status check karna hai",
  "Check my income tax refund status",
  "Link my PAN with Aadhaar",
  "मेरा आधार लिंक करना है",
];

const LANGS = [
  { code: "en-IN", label: "EN" },
  { code: "hi-IN", label: "हिन्दी" },
];

export function VoiceGovAssistant() {
  const { state, submitVoice, confirm, cancel, reset } = useVoiceGov();
  const [expanded, setExpanded] = useState(true);
  const [lang, setLang] = useState("en-IN");
  const [typed, setTyped] = useState("");

  // Keep the latest engine state in a ref for the speech callback.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const onFinal = useCallback(
    (text: string) => {
      const s = stateRef.current;
      if (text.trim().length < 2) return;
      // Ignore audio captured while VoiceGov is busy or talking. Confirmation
      // speech ("yes", "no", or "actually my PAN is …") IS handled — it's
      // routed through the interpreter by submitVoice.
      if (s.running || s.speaking) return;
      submitVoice(text);
    },
    [submitVoice]
  );

  const speech = useSpeech({ lang, onFinal });

  // Auto-open the panel whenever there is something to show.
  useEffect(() => {
    if (
      state.transcript ||
      state.timeline.length > 0 ||
      state.pending ||
      state.running
    ) {
      setExpanded(true);
    }
  }, [state.transcript, state.timeline.length, state.pending, state.running]);

  // Restart recognition with the new language if it changes while listening.
  useEffect(() => {
    if (speech.listening) {
      speech.stop();
      const t = setTimeout(() => speech.start(), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const toggleMic = () => {
    setExpanded(true);
    if (speech.listening) speech.stop();
    else speech.start();
  };

  const submitTyped = () => {
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    submitVoice(t);
  };

  const mode = getMode(state, speech.listening);
  const caption = getCaption(state, speech.listening, speech.permission);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex items-end gap-3">
        {expanded && (
          <div className="flex max-h-[78vh] w-[360px] max-w-[88vw] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black">
                  V
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-bold">VoiceGov</div>
                  <div className="text-[10px] text-slate-400">
                    {state.plannerSource
                      ? `planner: ${state.plannerSource}`
                      : "voice assistant"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex overflow-hidden rounded-md border border-slate-600 text-[10px]">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      className={`px-1.5 py-1 transition ${
                        lang === l.code
                          ? "bg-indigo-500 text-white"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                  aria-label="Collapse"
                >
                  ▾
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {/* Live transcript */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {speech.interim ? "Hearing…" : "Transcript"}
                </div>
                {speech.interim ? (
                  <p className="text-sm italic text-slate-300">
                    “{speech.interim}”
                  </p>
                ) : state.transcript ? (
                  <p className="text-sm">“{state.transcript}”</p>
                ) : (
                  <p className="text-sm italic text-slate-500">
                    Tap the mic and speak, or type below.
                  </p>
                )}

                {/* Live mic level meter — shows the mic is actually hearing you */}
                {speech.listening && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">mic</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-500 transition-[width] duration-75"
                        style={{ width: `${Math.round(speech.level * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {state.intent && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                      {state.intent.intent}
                    </span>
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                      {state.intent.language}
                    </span>
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                      {Math.round(state.intent.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>

              <ActionTimeline items={state.timeline} />

              {/* Suggestions */}
              {state.timeline.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submitVoice(s)}
                      className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-indigo-400 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {!speech.supported && (
                <p className="rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                  Voice input isn’t supported in this browser. Use Chrome, or
                  type your request below.
                </p>
              )}
              {speech.permission === "denied" && (
                <div className="rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
                  Microphone is blocked. Click the 🔒/camera icon in the address
                  bar → allow <b>Microphone</b>, then{" "}
                  <button
                    onClick={() => location.reload()}
                    className="underline hover:text-red-200"
                  >
                    reload
                  </button>
                  .
                </div>
              )}
              {speech.error && speech.permission !== "denied" && (
                <p className="rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
                  {speech.error}
                </p>
              )}
            </div>

            {/* Footer: status + input */}
            <div className="space-y-2 border-t border-slate-700 px-4 py-3">
              <div className="flex items-start gap-2 text-xs text-slate-300">
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </span>
                <span className="flex-1">{state.status}</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTyped()}
                  placeholder={
                    state.pending?.kind === "input"
                      ? "Type your answer…"
                      : "Type a request…"
                  }
                  className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400"
                />
                <button
                  onClick={submitTyped}
                  className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-600"
                >
                  Send
                </button>
                <button
                  onClick={reset}
                  title="Reset demo"
                  className="rounded-md border border-slate-600 px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                >
                  ↺
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orb + caption */}
        <div className="flex flex-col items-center gap-1.5">
          <VoiceOrb mode={mode} onClick={toggleMic} level={speech.level} />
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium shadow ${captionStyle(
              mode
            )}`}
          >
            {caption}
          </span>
        </div>
      </div>

      {state.pending?.kind === "confirmation" && (
        <ConfirmationDialog
          summary={state.pending.summary}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </>
  );
}

function getMode(
  state: ReturnType<typeof useVoiceGov>["state"],
  listening: boolean
): OrbMode {
  if (state.pending?.kind === "confirmation") return "confirm";
  if (state.running) return "thinking";
  if (state.speaking) return "speaking";
  if (listening) return "listening";
  return "idle";
}

function getCaption(
  state: ReturnType<typeof useVoiceGov>["state"],
  listening: boolean,
  permission: string
): string {
  if (state.pending?.kind === "confirmation") return "Confirm to continue";
  if (state.running) return "Working…";
  if (state.speaking) return "Speaking…";
  if (state.pending?.kind === "input")
    return listening ? "Listening for your answer…" : "Answer needed";
  if (listening) return "Listening…";
  if (permission === "denied") return "Mic blocked";
  return "Tap to talk";
}

function captionStyle(mode: OrbMode): string {
  switch (mode) {
    case "listening":
      return "bg-rose-500 text-white";
    case "thinking":
    case "confirm":
      return "bg-amber-500 text-white";
    case "speaking":
      return "bg-emerald-500 text-white";
    default:
      return "bg-slate-800 text-slate-200";
  }
}
