"use client";

import { replicaStore, useReplica } from "@/lib/replica/store";

const STATUS_STYLE: Record<
  string,
  { badge: string; ring: string; icon: string }
> = {
  issued: {
    badge: "bg-green-100 text-green-800",
    ring: "border-green-200",
    icon: "✅",
  },
  under_process: {
    badge: "bg-amber-100 text-amber-800",
    ring: "border-amber-200",
    icon: "⏳",
  },
  no_records: {
    badge: "bg-red-100 text-red-700",
    ring: "border-red-200",
    icon: "⚠️",
  },
};

export function ResultPage() {
  const { result } = useReplica();
  if (!result) return null;
  const style = STATUS_STYLE[result.status] ?? STATUS_STYLE.under_process;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-xs text-slate-500">
        Home <span className="mx-1">›</span> Our Services{" "}
        <span className="mx-1">›</span> Know Your Refund Status{" "}
        <span className="mx-1">›</span>{" "}
        <span className="font-medium text-slate-700">Status</span>
      </nav>

      <div
        id="refund-result"
        className={`overflow-hidden rounded-lg border bg-white shadow-sm ${style.ring}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <span className="text-2xl">{style.icon}</span>
          <div>
            <h1 className="text-lg font-bold text-[#0b3d67]">
              {result.headline}
            </h1>
            <span
              className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${style.badge}`}
            >
              {result.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-slate-700">{result.detail}</p>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <Row label="PAN" value={maskPan(result.pan)} />
            <Row label="Assessment Year" value={result.assessment_year} />
            {result.amount && <Row label="Refund Amount" value={result.amount} />}
            {result.mode && <Row label="Refund Mode" value={result.mode} />}
            {result.reference_no && (
              <Row label="Reference No." value={result.reference_no} />
            )}
            {result.date && <Row label="Status As On" value={result.date} />}
          </dl>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                replicaStore.setPan("");
                replicaStore.navigate("refund_form");
              }}
              className="rounded bg-[#0b5cab] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4f92]"
            >
              Check Another Refund
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-200/60 pb-2 sm:border-none sm:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function maskPan(pan: string): string {
  if (pan.length <= 4) return pan;
  return `${pan.slice(0, 3)}${"\u2022".repeat(pan.length - 4)}${pan.slice(-1)}`;
}
