"use client";

import { replicaStore, useReplica } from "@/lib/replica/store";
import type { ServiceDef } from "@/lib/services/catalog";

/**
 * Generic, data-driven service form. Renders any service's fields from the
 * catalog, with DOM ids the executor targets (#fld-<id>-<key>, #svc-<id>-submit).
 */
export function FormPage({ service }: { service: ServiceDef }) {
  const { values, loading, fieldErrors } = useReplica();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-xs text-slate-500">
        Home <span className="mx-1">›</span> Our Services{" "}
        <span className="mx-1">›</span>{" "}
        <span className="font-medium text-slate-700">{service.title}</span>
      </nav>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h1 className="text-lg font-bold text-[#0b3d67]">{service.title}</h1>
          <p className="mt-1 text-xs text-slate-600">
            {service.description} Fields marked{" "}
            <span className="text-red-500">*</span> are mandatory.
          </p>
        </div>

        <form
          className="space-y-5 px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            replicaStore.submit();
          }}
        >
          {service.fields.map((f) => {
            const id = `fld-${service.id}-${f.key}`;
            const val = values[f.key] ?? "";
            const err = fieldErrors[f.key];
            return (
              <div key={f.key}>
                <label
                  htmlFor={id}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  {f.label} <span className="text-red-500">*</span>
                </label>
                {f.kind === "select" ? (
                  <select
                    id={id}
                    value={val}
                    onChange={(e) => replicaStore.setField(f.key, e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#0b5cab] focus:ring-2 focus:ring-[#0b5cab]/20"
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="text"
                    autoComplete="off"
                    placeholder={f.placeholder}
                    value={val}
                    onChange={(e) =>
                      replicaStore.setField(
                        f.key,
                        f.parse === "pan"
                          ? e.target.value.toUpperCase()
                          : e.target.value
                      )
                    }
                    className={`w-full rounded border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                      f.parse === "pan" ? "uppercase tracking-wider" : ""
                    } ${
                      err
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:border-[#0b5cab] focus:ring-[#0b5cab]/20"
                    }`}
                  />
                )}
                {err && (
                  <p className="mt-1 text-xs font-medium text-red-600">{err}</p>
                )}
              </div>
            );
          })}

          <div className="rounded bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Note: This is a hackathon prototype. OTP / CAPTCHA verification is
            simulated and no real request is made to any government system.
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              id={`svc-${service.id}-submit`}
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-[#0b5cab] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0a4f92] disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? "Processing…" : service.submitLabel}
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
