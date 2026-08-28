"use client";

import { replicaStore, useReplica } from "@/lib/replica/store";

const STATUS_STYLE: Record<
  string,
  { badge: string; ring: string; icon: string }
> = {
  success: {
    badge: "bg-green-100 text-green-800",
    ring: "border-green-200",
    icon: "✅",
  },
  warning: {
    badge: "bg-amber-100 text-amber-800",
    ring: "border-amber-200",
    icon: "⏳",
  },
  error: {
    badge: "bg-red-100 text-red-700",
    ring: "border-red-200",
    icon: "⚠️",
  },
};

export function ResultPage() {
  const { result } = useReplica();
  if (!result) return null;
  const style = STATUS_STYLE[result.status] ?? STATUS_STYLE.warning;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-xs text-slate-500">
        Home <span className="mx-1">›</span> Our Services{" "}
        <span className="mx-1">›</span>{" "}
        <span className="font-medium text-slate-700">Status</span>
      </nav>

      <div
        id="service-result"
        className={`overflow-hidden rounded-lg border bg-white shadow-sm ${style.ring}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <span className="text-2xl">{style.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-indigo-900">
              {result.headline}
            </h1>
            <span
              className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${style.badge}`}
            >
              {result.status}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-slate-700">{result.detail}</p>

          {result.rows.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
              {result.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between border-b border-slate-200/60 pb-2 sm:border-none sm:pb-0"
                >
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="font-semibold text-slate-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => replicaStore.navigate("services")}
              className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Back to Services
            </button>
            <button
              onClick={() => replicaStore.navigate("home")}
              className="rounded px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
