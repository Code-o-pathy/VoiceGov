import type { Workflow } from "@/schemas/workflow";
import { SERVICES, buildWorkflowFromService } from "@/lib/services/catalog";

/** All workflows known to VoiceGov, generated from the service catalog. */
export const WORKFLOWS: Record<string, Workflow> = Object.fromEntries(
  SERVICES.map((s) => [s.id, buildWorkflowFromService(s)])
);

/** Map a detected intent to a workflow id. Intent ids ARE service ids. */
export const INTENT_TO_WORKFLOW: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.id])
);

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
