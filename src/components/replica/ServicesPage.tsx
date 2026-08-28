"use client";

import { replicaStore } from "@/lib/replica/store";
import type { ReplicaState } from "@/schemas/workflow";

interface ServiceTile {
  label: string;
  desc: string;
  id?: string;
  route?: ReplicaState;
}

const SERVICES: ServiceTile[] = [
  { label: "Instant e-PAN", desc: "Get a new PAN instantly using Aadhaar." },
  {
    label: "Link Aadhaar",
    desc: "Link your PAN with Aadhaar.",
    id: "link-aadhaar-link",
    route: "aadhaar_form" as const,
  },
  { label: "e-Pay Tax", desc: "Pay direct taxes online." },
  {
    label: "Know Your Refund Status",
    desc: "Check the status of your income tax refund.",
    id: "refund-status-link",
    route: "refund_form" as const,
  },
  { label: "Verify Your PAN", desc: "Verify your PAN details." },
  { label: "Know TAN Details", desc: "Search TAN of a deductor." },
  { label: "Authenticate Notice", desc: "Verify notices issued by ITD." },
  { label: "Tax Calculator", desc: "Estimate your tax liability." },
];

export function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-4 text-xs text-slate-500">
        Home <span className="mx-1">›</span>{" "}
        <span className="font-medium text-slate-700">Our Services</span>
      </nav>
      <h1 className="text-xl font-bold text-[#0b3d67]">Our Services</h1>
      <p className="mt-1 text-sm text-slate-600">
        Select a service to continue. No login is required for the services
        below.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const clickable = Boolean(s.route);
          return (
            <button
              key={s.label}
              id={s.id}
              onClick={() => s.route && replicaStore.navigate(s.route)}
              className={`group rounded-lg border p-5 text-left shadow-sm transition ${
                clickable
                  ? "border-slate-200 bg-white hover:border-[#0b5cab] hover:shadow-md"
                  : "border-slate-200 bg-white/60"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold text-[#0b3d67]">
                  {s.label}
                </span>
                <span className="text-[#0b5cab] opacity-0 transition group-hover:opacity-100">
                  →
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{s.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
