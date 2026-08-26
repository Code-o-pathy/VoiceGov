"use client";

import type { TimelineItem } from "@/lib/voicegov/useVoiceGov";

export function ActionTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Action Timeline
      </div>
      {items.length === 0 ? (
        <p className="text-sm italic text-slate-500">
          Actions VoiceGov performs on the website will appear here.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <StatusDot status={item.status} />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm ${
                    item.status === "error"
                      ? "text-red-300"
                      : item.status === "done"
                      ? "text-slate-200"
                      : "text-indigo-200"
                  }`}
                >
                  {item.label}
                </div>
                {item.detail && (
                  <div className="truncate text-[11px] text-slate-400">
                    {item.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: TimelineItem["status"] }) {
  if (status === "done")
    return (
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
        ✓
      </span>
    );
  if (status === "error")
    return (
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
        !
      </span>
    );
  return (
    <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 border-indigo-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
    </span>
  );
}
