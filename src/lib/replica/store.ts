"use client";

import { useSyncExternalStore } from "react";
import type { ReplicaState, StoreField } from "@/schemas/workflow";
import { FieldError, serviceDelay, type ServiceResult } from "./mockApi";
import { serviceByFormState, SERVICES } from "@/lib/services/catalog";

export interface ReplicaStore {
  route: ReplicaState;
  /** Generic form values keyed by field key (pan, aadhaar, mobile, …). */
  values: Record<string, string>;
  loading: boolean;
  /** Inline validation errors keyed by store field. */
  fieldErrors: Record<string, string>;
  result: ServiceResult | null;
}

/** Field defaults across all services (e.g. assessmentYear). */
function defaultValues(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const s of SERVICES)
    for (const f of s.fields) if (f.default) v[f.key] = f.default;
  return v;
}

const INITIAL: ReplicaStore = {
  route: "home",
  values: defaultValues(),
  loading: false,
  fieldErrors: {},
  result: null,
};

let state: ReplicaStore = { ...INITIAL, values: { ...INITIAL.values } };
const listeners = new Set<() => void>();

function set(patch: Partial<ReplicaStore>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const replicaStore = {
  get: (): ReplicaStore => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  navigate(route: ReplicaState) {
    set({ route });
  },
  setField(field: StoreField, value: string) {
    const fieldErrors = { ...state.fieldErrors };
    delete fieldErrors[field];
    set({ values: { ...state.values, [field]: value }, fieldErrors });
  },
  value(field: string): string {
    return state.values[field] ?? "";
  },
  async submit() {
    const def = serviceByFormState(state.route);
    if (!def) return;
    set({ loading: true, fieldErrors: {} });
    try {
      await serviceDelay();
      // Validate each field; surface the first error inline.
      for (const f of def.fields) {
        const raw = state.values[f.key] ?? "";
        const err = f.validate?.(raw);
        if (err) throw new FieldError(f.key, err);
      }
      const result = def.run(state.values);
      set({ loading: false, result, route: "result" });
    } catch (e) {
      const field =
        e instanceof FieldError ? e.field : def.fields[0]?.key ?? "pan";
      const message =
        e instanceof Error ? e.message : "Something went wrong. Try again.";
      set({ loading: false, fieldErrors: { [field]: message } });
    }
  },
  reset() {
    state = { ...INITIAL, values: defaultValues() };
    listeners.forEach((l) => l());
  },
  /** Reset the journey (route/result/inputs) without touching session. */
  softReset() {
    set({
      route: "home",
      values: defaultValues(),
      result: null,
      fieldErrors: {},
      loading: false,
    });
  },
};

export function useReplica(): ReplicaStore {
  return useSyncExternalStore(
    replicaStore.subscribe,
    replicaStore.get,
    replicaStore.get
  );
}
