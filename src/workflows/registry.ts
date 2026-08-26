import type { Workflow } from "@/schemas/workflow";
import { refundStatusWorkflow } from "./refund-status";

/** All workflows known to VoiceGov, keyed by workflow_id. */
export const WORKFLOWS: Record<string, Workflow> = {
  [refundStatusWorkflow.workflow_id]: refundStatusWorkflow,
};

/** Map a detected intent to a workflow id. */
export const INTENT_TO_WORKFLOW: Record<string, string> = {
  check_refund_status: "refund_status",
};

export function getWorkflowForIntent(intent: string): Workflow | undefined {
  const id = INTENT_TO_WORKFLOW[intent];
  return id ? WORKFLOWS[id] : undefined;
}

export function getWorkflow(id: string): Workflow | undefined {
  return WORKFLOWS[id];
}

/**
 * Semantic element id -> DOM selector map used exclusively by the executor.
 * Keeping this here (application code) means the LLM can never invent
 * selectors; it only references stable semantic ids.
 */
export function buildElementRegistry(
  workflow: Workflow
): Record<string, string> {
  const registry: Record<string, string> = {};
  for (const [id, el] of Object.entries(workflow.elements)) {
    registry[id] = el.dom;
  }
  return registry;
}
