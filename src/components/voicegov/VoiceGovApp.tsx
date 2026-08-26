"use client";

import { useVoiceGov } from "@/lib/voicegov/useVoiceGov";
import { WebsiteReplica } from "@/components/replica/WebsiteReplica";
import { VoiceControl } from "./VoiceControl";
import { TranscriptPanel } from "./TranscriptPanel";
import { ActionTimeline } from "./ActionTimeline";
import { ConfirmationDialog } from "./ConfirmationDialog";

const SUGGESTIONS = [
  "Mujhe apna income tax refund status check karna hai",
  "Check my income tax refund status",
  "मुझे रिफंड स्टेटस देखना है",
];

export function VoiceGovApp() {
  const { state, submitVoice, confirm, cancel, reset } = useVoiceGov();
  const awaitingInput = state.pending?.kind === "input";

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
            V
          </span>
          <div>
            <div className="text-sm font-bold text-white">VoiceGov</div>
            <div className="text-[10px] text-slate-400">
              Voice-first layer for public-service portals
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 text-xs ${
              state.running ? "text-red-400" : "text-slate-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                state.running ? "animate-pulse bg-red-500" : "bg-slate-600"
              }`}
            />
            {state.running ? "Working" : "Idle"}
          </span>
          <button
            onClick={reset}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_380px]">
        {/* Replica */}
        <div className="overflow-hidden border-r border-slate-800">
          <WebsiteReplica />
        </div>

        {/* VoiceGov panel */}
        <aside className="flex flex-col overflow-y-auto bg-slate-900 p-4 text-slate-100">
          <VoiceControl
            onSubmit={submitVoice}
            running={state.running}
            awaitingInput={awaitingInput}
            promptHint={
              awaitingInput && state.pending?.kind === "input"
                ? state.pending.prompt
                : undefined
            }
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
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

          <div className="mt-4 space-y-3">
            <TranscriptPanel
              transcript={state.transcript}
              intent={state.intent}
              plannerSource={state.plannerSource}
            />
            <ActionTimeline items={state.timeline} />
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Status
        </span>
        <span className="truncate">{state.status}</span>
      </div>

      {state.pending?.kind === "confirmation" && (
        <ConfirmationDialog
          summary={state.pending.summary}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
