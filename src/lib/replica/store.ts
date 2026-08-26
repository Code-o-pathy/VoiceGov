"use client";

import { useSyncExternalStore } from "react";
import type { ReplicaState } from "@/schemas/workflow";
import { checkRefundStatus, type RefundResult } from "./mockApi";

export interface ReplicaStore {
  route: ReplicaState;
  pan: string;
  assessmentYear: string;
  loading: boolean;
  fieldErrors: Record<string, string>;
  result: RefundResult | null;
}

const INITIAL: ReplicaStore = {
  route: "home",
  pan: "",
  assessmentYear: "2025-26",
  loading: false,
  fieldErrors: {},
  result: null,
};

let state: ReplicaStore = { ...INITIAL };
const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

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
  setPan(pan: string) {
    const fieldErrors = { ...state.fieldErrors };
    delete fieldErrors.pan_input;
    set({ pan, fieldErrors });
  },
  setAssessmentYear(assessmentYear: string) {
    set({ assessmentYear });
  },
  async submit() {
    set({ loading: true, fieldErrors: {} });
    try {
      const result = await checkRefundStatus(state.pan, state.assessmentYear);
      set({ loading: false, result, route: "result" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Try again.";
      set({
        loading: false,
        fieldErrors: { pan_input: message },
      });
    }
  },
  reset() {
    state = { ...INITIAL };
    emit();
  },
};

/** React binding. */
export function useReplica(): ReplicaStore {
  return useSyncExternalStore(
    replicaStore.subscribe,
    replicaStore.get,
    replicaStore.get
  );
}
