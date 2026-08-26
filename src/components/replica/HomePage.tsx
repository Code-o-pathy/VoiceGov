"use client";

import { replicaStore } from "@/lib/replica/store";

const QUICK_TILES = [
  { label: "Link Aadhaar", icon: "🔗" },
  { label: "e-Verify Return", icon: "✅" },
  { label: "Know Your Refund Status", icon: "💸", go: true },
  { label: "e-Pay Tax", icon: "🧾" },
  { label: "Verify Your PAN", icon: "🪪" },
  { label: "Instant e-PAN", icon: "⚡" },
];

export function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-r from-[#0b3d67] to-[#0b5cab] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-white/70">
            e-Filing Portal
          </p>
          <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-snug sm:text-3xl">
            File your returns, pay taxes and access services — anywhere, anytime.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80">
            Access a wide range of taxpayer services provided by the Income Tax
            Department, Government of India.
          </p>
          <button
            onClick={() => replicaStore.navigate("services")}
            className="mt-5 rounded bg-[#f26522] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#d9551a]"
          >
            Explore Our Services →
          </button>
        </div>
      </section>

      {/* Quick access tiles */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#0b3d67]">
          Frequently Used Services
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_TILES.map((t) => (
            <button
              key={t.label}
              onClick={() => replicaStore.navigate("services")}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#0b5cab] hover:shadow"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-medium text-slate-700">
                {t.label}
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
              t: "Latest Updates",
              d: "Due date for filing return of income for AY 2026-27 extended.",
            },
            {
              t: "Taxpayer Services",
              d: "24x7 helpdesk available for e-Filing related queries.",
            },
            {
              t: "Refund Status",
              d: "Track your income tax refund online using your PAN.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm font-semibold text-[#0b3d67]">{c.t}</div>
              <p className="mt-1 text-xs text-slate-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
