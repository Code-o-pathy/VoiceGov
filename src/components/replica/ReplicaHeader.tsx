"use client";

import { replicaStore, useReplica } from "@/lib/replica/store";

const NAV = [
  { id: "home", label: "Home", route: "home" as const },
  { id: "nav-services-link", label: "Services", route: "services" as const },
  { id: "nav-downloads", label: "Downloads", route: null },
  { id: "nav-help", label: "Help", route: null },
];

export function ReplicaHeader() {
  const { route } = useReplica();

  return (
    <header className="w-full">
      {/* Demo badge strip */}
      <div className="bg-indigo-900 text-white text-[11px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-900">
              Demo
            </span>
            <span className="tracking-wide">
              VoiceGov Prototype · Educational Demo Only
            </span>
          </div>
          <div className="hidden gap-4 sm:flex">
            <span>A+ A A-</span>
            <span>English</span>
            <span>हिन्दी</span>
          </div>
        </div>
      </div>

      {/* Brand row */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={() => replicaStore.navigate("home")}
            className="flex items-center gap-3 text-left"
          >
            <Emblem />
            <div>
              <div className="text-[17px] font-bold leading-tight text-indigo-900">
                Public Services Portal
              </div>
              <div className="text-[11px] font-medium text-purple-600">
                Demo Replica · Voice-First Interface
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">
              Voice Powered
            </span>
            <button className="rounded border border-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
              Register
            </button>
            <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              Login
            </button>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="bg-indigo-600 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2">
          {NAV.map((item) => {
            const active =
              item.route === route ||
              (item.route === "services" && route === "refund_form");
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => item.route && replicaStore.navigate(item.route)}
                className={`px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-white/15 shadow-inner"
                    : "hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <span className="ml-auto px-4 py-2.5 text-[13px] font-medium text-white/80">
            Quick Links ▾
          </span>
        </div>
      </nav>
    </header>
  );
}

function Emblem() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow">
      <span className="text-lg font-black leading-none">VG</span>
    </div>
  );
}
