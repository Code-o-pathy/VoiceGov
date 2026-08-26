"use client";

import { useEffect, useState } from "react";
import { useSpeech } from "@/lib/stt/useSpeech";

interface Props {
  onSubmit: (text: string) => void;
  running: boolean;
  awaitingInput: boolean;
  promptHint?: string;
}

const LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
];

export function VoiceControl({
  onSubmit,
  running,
  awaitingInput,
  promptHint,
}: Props) {
  const [lang, setLang] = useState("en-IN");
  const [typed, setTyped] = useState("");
  const speech = useSpeech(lang);

  useEffect(() => {
    return () => speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      speech.start((text) => onSubmit(text));
    }
  };

  const submitTyped = () => {
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    onSubmit(t);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Voice Command
        </span>
        <div className="flex overflow-hidden rounded-md border border-slate-600 text-[11px]">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-2 py-1 transition ${
                lang === l.code
                  ? "bg-indigo-500 text-white"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <button
          onClick={handleMic}
          disabled={!speech.supported}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition disabled:opacity-40 ${
            speech.listening
              ? "bg-red-500"
              : "bg-indigo-500 hover:bg-indigo-400"
          }`}
        >
          {speech.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
          )}
          <MicIcon />
        </button>
        <p className="mt-3 text-center text-sm text-slate-300">
          {speech.listening
            ? "Listening… speak now"
            : awaitingInput
            ? promptHint || "Provide the requested information"
            : running
            ? "Working…"
            : "Tap to speak"}
        </p>
        {!speech.supported && (
          <p className="mt-1 text-center text-[11px] text-amber-400">
            Voice not supported here — use the text box below.
          </p>
        )}
        {speech.error && (
          <p className="mt-1 text-center text-[11px] text-red-400">
            {speech.error}
          </p>
        )}
        {speech.interim && (
          <p className="mt-2 max-w-full truncate text-center text-xs italic text-slate-400">
            “{speech.interim}”
          </p>
        )}
      </div>

      {/* Typed fallback */}
      <div className="mt-4 flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitTyped()}
          placeholder={
            awaitingInput
              ? "Type the requested value…"
              : 'e.g. "Mujhe refund status check karna hai"'
          }
          className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
        />
        <button
          onClick={submitTyped}
          className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
