import type { Observation } from "@/schemas/planner";
import type { Workflow } from "@/schemas/workflow";
import { replicaStore } from "@/lib/replica/store";
import { maskPan, maskAadhaar } from "@/lib/replica/mockApi";

/**
 * Produce a COMPACT semantic observation of the replica for the planner.
 * Workflow-driven: reads whichever fields the current page's elements bind to.
 * Never returns the DOM or full page source — only semantic state.
 */
export function observe(workflow: Workflow): Observation {
  const s = replicaStore.get();

  const onState = Object.entries(workflow.elements).filter(
    ([, el]) => el.state === s.route
  );

  const values: Record<string, string> = {};
  const field_errors: Record<string, string> = {};

  for (const [id, el] of onState) {
    if (!el.field) continue;
    const raw = s.values[el.field] ?? "";
    if (raw) values[id] = maskField(el.field, raw);
    if (s.fieldErrors[el.field]) field_errors[id] = s.fieldErrors[el.field];
  }

  return {
    state: s.route,
    visible_elements: onState.map(([id]) => id),
    values,
    loading: s.loading,
    field_errors,
    has_result: Boolean(s.result),
    result_status: s.result?.status,
  };
}

function maskField(field: string, value: string): string {
  if (field === "pan") return maskPan(value);
  if (field === "aadhaar") return maskAadhaar(value);
  return value;
}
