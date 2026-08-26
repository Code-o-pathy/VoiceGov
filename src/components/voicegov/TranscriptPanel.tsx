"use client";

import type { ReactNode } from "react";
import type { Intent } from "@/schemas/planner";

interface Props {
  transcript: string;
  intent: Intent | null;
  plannerSource: string;
}

export function TranscriptPanel({ transcript, intent, plannerSource }: Props) {
  return (
    <div className="space-y-3">
      <Block title="Transcript">
        {transcript ? (
          <p className="text-sm text-slate-100">“{transcript}”</p>
        ) : (
          <p className="text-sm italic text-slate-500">
            Your spoken words will appear here.
          </p>
        )}
      </Block>

      <Block title="Interpreted Intent">
        {intent ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                {intent.intent}
              </span>
              <span className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                {intent.language}
              </span>
              <span className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                {Math.round(intent.confidence * 100)}% confident
              </span>
              {plannerSource && (
                <span className="ml-auto rounded bg-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  planner: {plannerSource}
                </span>
              )}
            </div>
            {Object.keys(intent.entities).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(intent.entities).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {k}: <span className="font-mono">{maskIfPan(k, v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-slate-500">
            VoiceGov will show what it understood here.
          </p>
        )}
      </Block>
    </div>
  );
}

function maskIfPan(key: string, value: string): string {
  if (key.toLowerCase() === "pan" && value.length > 2) {
    return "\u2022".repeat(value.length - 1) + value.slice(-1);
  }
  return value;
}

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      {children}
    </div>
  );
}
