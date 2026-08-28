"use client";

import { replicaStore } from "@/lib/replica/store";
import { SERVICES, formStateFor } from "@/lib/services/catalog";

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
        {SERVICES.map((s) => (
          <button
            key={s.id}
            id={`svc-${s.id}-link`}
            onClick={() => replicaStore.navigate(formStateFor(s.id))}
            className="group rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#0b5cab] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#0b3d67]">
                <span className="text-lg">{s.icon}</span>
                {s.title}
              </span>
              <span className="text-[#0b5cab] opacity-0 transition group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
