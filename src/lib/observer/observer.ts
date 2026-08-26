import type { Observation } from "@/schemas/planner";
import type { Workflow } from "@/schemas/workflow";
import { replicaStore } from "@/lib/replica/store";

/**
 * Produce a COMPACT semantic observation of the replica for the planner.
 * Never returns the DOM or full page source — only semantic state.
 */
export function observe(workflow: Workflow): Observation {
  const s = replicaStore.get();

  const visible_elements = Object.entries(workflow.elements)
    .filter(([, el]) => el.state === s.route)
    .map(([id]) => id);

  const values: Record<string, string> = {};
  if (s.route === "refund_form") {
    if (s.pan) values.pan_input = maskPan(s.pan);
    if (s.assessmentYear) values.assessment_year = s.assessmentYear;
  }

  return {
    state: s.route,
    visible_elements,
    values,
    loading: s.loading,
    field_errors: renameKeys(s.fieldErrors),
    has_result: Boolean(s.result),
    result_status: s.result?.status,
  };
}

/** Mask everything but the last character so PANs never leak verbatim. */
function maskPan(pan: string): string {
  if (pan.length <= 2) return "\u2022".repeat(pan.length);
  return "\u2022".repeat(pan.length - 1) + pan.slice(-1);
}

function renameKeys(errors: Record<string, string>): Record<string, string> {
  // Keep semantic ids as-is; they already match the registry.
  return { ...errors };
}
