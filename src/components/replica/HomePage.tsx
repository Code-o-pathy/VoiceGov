"use client";

import { replicaStore } from "@/lib/replica/store";
import { SERVICES, formStateFor } from "@/lib/services/catalog";

const QUICK_TILES = SERVICES.slice(0, 6);

export function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-3 inline-block rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold uppercase text-indigo-900">
            Prototype Demo
          </div>
          <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-snug sm:text-3xl">
            Experience voice-first public service access — speak naturally, navigate easily.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80">
            VoiceGov demonstrates how natural language voice commands can simplify complex digital services.
          </p>
          <button
            onClick={() => replicaStore.navigate("services")}
            className="mt-5 rounded bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-purple-700"
          >
            Explore Demo Services →
          </button>
        </div>
      </section>

      {/* Quick access tiles */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-indigo-900">
          Popular Demo Services
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_TILES.map((t) => (
            <button
              key={t.id}
              id={`svc-${t.id}-link`}
              onClick={() => replicaStore.navigate(formStateFor(t.id))}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-600 hover:shadow"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-medium text-slate-700">
                {t.title}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Info band */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-8 sm:grid-cols-3">
          {[
            {
              t: "About This Demo",
              d: "VoiceGov is a voice-first interface prototype for complex digital services.",
            },
            {
              t: "How It Works",
              d: "Speak naturally in English, Hindi, or Hinglish — the AI understands and operates the interface.",
            },
            {
              t: "Educational Project",
              d: "Built for demonstration purposes. Uses synthetic data only.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-semibold text-indigo-900">{c.t}</div>
              <p className="mt-1 text-xs text-slate-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
