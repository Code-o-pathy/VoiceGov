import { ActionSchema, type Action } from "@/schemas/actions";
import type { Workflow, ReplicaState } from "@/schemas/workflow";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Every LLM action must pass validation before execution. Invalid actions are
 * rejected outright — never silently "repaired" by guessing behaviour.
 */
export function validateAction(
  raw: unknown,
  workflow: Workflow,
  currentState: ReplicaState
): ValidationResult {
  // 1. Valid schema / no unknown fields (strict schema rejects extras).
  const parsed = ActionSchema.safeParse(raw);
  if (!parsed.success) {
    return { valid: false, reason: "Malformed action or unknown fields." };
  }
  const action: Action = parsed.data;

  // 2. request_user_input needs a field only.
  if (action.action === "request_user_input") {
    if (!action.field) {
      return { valid: false, reason: "request_user_input requires a field." };
    }
    return { valid: true };
  }

  // 3. Actions that operate on an element need a known semantic id.
  if (!action.element_id) {
    return { valid: false, reason: `${action.action} requires an element_id.` };
  }
  const el = workflow.elements[action.element_id];
  if (!el) {
    return {
      valid: false,
      reason: `Unknown semantic element: ${action.element_id}.`,
    };
  }

  // 4. Element must belong to the current page state.
  if (el.state !== currentState) {
    return {
      valid: false,
      reason: `Element ${action.element_id} is not available on state "${currentState}".`,
    };
  }

  // 5. Per-action-type checks.
  switch (action.action) {
    case "click":
    case "navigate":
      if (el.type !== "link" && el.type !== "button") {
        return {
          valid: false,
          reason: `Cannot ${action.action} a ${el.type}.`,
        };
      }
      return { valid: true };

    case "fill":
      if (el.type !== "input") {
        return { valid: false, reason: `Cannot fill a ${el.type}.` };
      }
      if (!action.value && !action.value_ref) {
        return { valid: false, reason: "fill requires value or value_ref." };
      }
      return { valid: true };

    case "select": {
      if (el.type !== "select") {
        return { valid: false, reason: `Cannot select on a ${el.type}.` };
      }
      if (!action.value) {
        return { valid: false, reason: "select requires a value." };
      }
      if (el.options && !el.options.includes(action.value)) {
        return {
          valid: false,
          reason: `"${action.value}" is not an allowed option for ${action.element_id}.`,
        };
      }
      return { valid: true };
    }

    case "read":
    case "highlight":
    case "scroll":
      return { valid: true };

    default:
      return { valid: false, reason: "Unsupported action type." };
  }
}
