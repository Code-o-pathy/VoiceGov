"use client";

import { replicaStore, useReplica } from "@/lib/replica/store";
import { refundStatusWorkflow } from "@/workflows/refund-status";

const AY_OPTIONS = refundStatusWorkflow.elements.assessment_year.options ?? [];

export function RefundFormPage() {
  const { pan, assessmentYear, loading, fieldErrors } = useReplica();
  const panError = fieldErrors.pan_input;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-xs text-slate-500">
        Home <span className="mx-1">›</span> Our Services{" "}
        <span className="mx-1">›</span>{" "}
        <span className="font-medium text-slate-700">
          Know Your Refund Status
        </span>
      </nav>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h1 className="text-lg font-bold text-[#0b3d67]">
            Know Your Refund Status
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Enter your PAN and select the Assessment Year to check your refund
            status. Fields marked <span className="text-red-500">*</span> are
            mandatory.
          </p>
        </div>

        <form
          className="space-y-5 px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            replicaStore.submit();
          }}
        >
          <div>
            <label
              htmlFor="pan-input"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              PAN / Aadhaar Number <span className="text-red-500">*</span>
            </label>
            <input
              id="pan-input"
              type="text"
              autoComplete="off"
              maxLength={10}
              placeholder="e.g. ABCDE1234F"
              value={pan}
              onChange={(e) =>
                replicaStore.setPan(e.target.value.toUpperCase())
              }
              className={`w-full rounded border px-3 py-2 text-sm uppercase tracking-wider outline-none transition focus:ring-2 ${
                panError
                  ? "border-red-400 focus:ring-red-200"
                  : "border-slate-300 focus:border-[#0b5cab] focus:ring-[#0b5cab]/20"
              }`}
            />
            {panError && (
              <p className="mt-1 text-xs font-medium text-red-600">{panError}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="assessment-year"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Assessment Year <span className="text-red-500">*</span>
            </label>
            <select
              id="assessment-year"
              value={assessmentYear}
              onChange={(e) => replicaStore.setAssessmentYear(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0b5cab] focus:ring-2 focus:ring-[#0b5cab]/20"
            >
              {AY_OPTIONS.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Note: This is a high-fidelity demo. OTP / CAPTCHA verification is
            simulated and no real request is made to any government system.
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              id="submit-refund"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-[#0b5cab] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0a4f92] disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => replicaStore.navigate("services")}
              className="rounded px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
