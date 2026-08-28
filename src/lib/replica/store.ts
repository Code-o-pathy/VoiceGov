"use client";

import { useSyncExternalStore } from "react";
import type { ReplicaState, StoreField } from "@/schemas/workflow";
import {
  checkRefundStatus,
  checkAadhaarLink,
  FieldError,
  type ServiceResult,
} from "./mockApi";

export interface ReplicaStore {
  route: ReplicaState;
  pan: string;
  assessmentYear: string;
  aadhaar: string;
  loading: boolean;
  /** Inline validation errors keyed by store field ("pan" | "aadhaar" | ...). */
  fieldErrors: Record<string, string>;
  result: ServiceResult | null;
}

const INITIAL: ReplicaStore = {
  route: "home",
  pan: "",
  assessmentYear: "2025-26",
  aadhaar: "",
  loading: false,
  fieldErrors: {},
  result: null,
};

let state: ReplicaStore = { ...INITIAL };
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
    set({ [field]: value, fieldErrors } as Partial<ReplicaStore>);
  },
  setPan(pan: string) {
    this.setField("pan", pan);
  },
  setAssessmentYear(assessmentYear: string) {
    this.setField("assessmentYear", assessmentYear);
  },
  setAadhaar(aadhaar: string) {
    this.setField("aadhaar", aadhaar);
  },
  async submit() {
    set({ loading: true, fieldErrors: {} });
    try {
      let result: ServiceResult;
      if (state.route === "refund_form") {
        result = await checkRefundStatus(state.pan, state.assessmentYear);
      } else if (state.route === "aadhaar_form") {
        result = await checkAadhaarLink(state.pan, state.aadhaar);
      } else {
        set({ loading: false });
        return;
      }
      set({ loading: false, result, route: "result" });
    } catch (e) {
      const field = e instanceof FieldError ? e.field : "pan";
      const message =
        e instanceof Error ? e.message : "Something went wrong. Try again.";
      set({ loading: false, fieldErrors: { [field]: message } });
    }
  },
  reset() {
    state = { ...INITIAL };
    listeners.forEach((l) => l());
  },
  /** Reset the journey (route/result/inputs) without touching session. */
  softReset() {
    set({
      route: "home",
      pan: "",
      aadhaar: "",
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
