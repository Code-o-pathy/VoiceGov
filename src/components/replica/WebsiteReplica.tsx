"use client";

import { useReplica } from "@/lib/replica/store";
import { ReplicaHeader } from "./ReplicaHeader";
import { HomePage } from "./HomePage";
import { ServicesPage } from "./ServicesPage";
import { RefundFormPage } from "./RefundFormPage";
import { AadhaarFormPage } from "./AadhaarFormPage";
import { ResultPage } from "./ResultPage";

/**
 * The high-fidelity replica of the Income Tax e-Filing portal. This is the
 * PRIMARY visual environment; VoiceGov operates it via the DOM executor.
 */
export function WebsiteReplica() {
  const { route } = useReplica();

  return (
    <div className="flex h-full flex-col bg-[#f4f6f9] text-slate-900">
      <ReplicaHeader />
      <main className="flex-1 overflow-y-auto">
        {route === "home" && <HomePage />}
        {route === "services" && <ServicesPage />}
        {route === "refund_form" && <RefundFormPage />}
        {route === "aadhaar_form" && <AadhaarFormPage />}
        {route === "result" && <ResultPage />}
      </main>
      <footer className="border-t border-slate-200 bg-[#0b3d67] px-6 py-3 text-center text-[11px] text-white/70">
        © Income Tax Department, Government of India · High-fidelity replica for
        demonstration only · No real data is transmitted.
      </footer>
    </div>
  );
}
