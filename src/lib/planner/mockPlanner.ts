import type { PlannerOutput, Action } from "@/schemas/actions";
import type { PlannerInput } from "@/schemas/planner";

type ElementView = PlannerInput["workflow"]["elements"][string];
type Entry = [string, ElementView];

/**
 * Deterministic, WORKFLOW-DRIVEN planner. Given the task, the current replica
 * state, and which required inputs are known, it emits the next semantic
 * action(s) purely from the workflow definition — nothing is hardcoded to a
 * specific service.
 *
 * This same logic powers the offline fallback AND acts as ground truth the LLM
 * route is expected to match. It never produces DOM selectors or code.
 */
export function planLocal(input: PlannerInput): PlannerOutput {
  const { current_page, session_known } = input;
  const state = current_page.id;
  const elements = Object.entries(input.workflow.elements) as Entry[];
  const onState = elements.filter(([, el]) => el.state === state);

  if (state === "result") {
    return {
      status: "complete",
      actions: [{ action: "read", element_id: firstOfType(onState, "result") }],
      needs_confirmation: false,
      needs_user_input: [],
      message: "Request complete.",
    };
  }

  // A form page has a button (the submit/continue control).
  const button = onState.find(([, el]) => el.type === "button");
  if (button) {
    const inputs = onState.filter(([, el]) => el.type === "input");
    const selects = onState.filter(([, el]) => el.type === "select");

    // 1. Missing-information handling: ask for the first unknown required input.
    for (const [, el] of inputs) {
      const key = el.sessionKey;
      if (key && !session_known[key]) {
        return {
          status: "need_input",
          actions: [],
          needs_confirmation: false,
          needs_user_input: [
            { field: key, prompt: promptFor(el.label, key) },
          ],
        };
      }
    }

    const allFilled = inputs.every(([id]) => Boolean(current_page.values[id]));
    const hasError = Object.keys(current_page.field_errors).length > 0;

    // 2. Fill the form (or refill after a correction).
    if (!allFilled || hasError) {
      const actions: Action[] = [];
      for (const [id, el] of inputs) {
        actions.push({
          action: "fill",
          element_id: id,
          value_ref: `user.${el.sessionKey}`,
        });
      }
      for (const [id, el] of selects) {
        actions.push({
          action: "select",
          element_id: id,
          value: selectValue(input, id, el),
        });
      }
      return ready(actions);
    }

    // 3. Consequential action -> confirmation gate before submitting.
    return {
      status: "need_confirmation",
      needs_confirmation: true,
      confirmation_summary: `Submit this ${input.workflow.description.toLowerCase()}?`,
      needs_user_input: [],
      actions: [{ action: "click", element_id: button[0] }],
    };
  }

  // Navigation pages: click the (single) link that belongs to this state.
  const link = onState.find(([, el]) => el.type === "link");
  if (link) {
    return ready([{ action: "click", element_id: link[0] }]);
  }

  return {
    status: "error",
    actions: [],
    needs_confirmation: false,
    needs_user_input: [],
    message: `No plan for state ${state}.`,
  };
}

function selectValue(
  input: PlannerInput,
  id: string,
  el: ElementView
): string {
  const options = el.options ?? [];
  const fromEntities =
    input.task.entities[id] || input.task.entities.assessment_year;
  if (fromEntities && (options.length === 0 || options.includes(fromEntities)))
    return fromEntities;
  // Default to the second option (typically the prior year) when present.
  return options[1] ?? options[0] ?? "";
}

function promptFor(label: string, key: string): string {
  if (key === "pan")
    return "I need your PAN. Please say or type your 10-character PAN (e.g. ABCDE1234F).";
  if (key === "aadhaar")
    return "I need your 12-digit Aadhaar number. Please say or type it.";
  return `I need your ${label}. Please say or type it.`;
}

function firstOfType(entries: Entry[], type: string): string {
  const found = entries.find(([, el]) => el.type === type);
  return found ? found[0] : "";
}

function ready(actions: Action[]): PlannerOutput {
  return {
    status: "ready",
    actions,
    needs_confirmation: false,
    needs_user_input: [],
  };
}
