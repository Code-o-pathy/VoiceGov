import type { PlannerOutput } from "@/schemas/actions";
import type { PlannerInput } from "@/schemas/planner";

/**
 * Deterministic planner. Given the task, the current replica state, and which
 * required inputs are known, it emits the next semantic action(s).
 *
 * This same logic powers the offline fallback AND acts as ground truth the LLM
 * route is expected to match. It never produces DOM selectors or code.
 */
export function planLocal(input: PlannerInput): PlannerOutput {
  const { current_page, session_known } = input;
  const state = current_page.id;

  switch (state) {
    case "home":
      return ready([{ action: "click", element_id: "services_link" }]);

    case "services":
      return ready([{ action: "click", element_id: "refund_status_link" }]);

    case "refund_form": {
      // 1. Missing information handling: need PAN before we can proceed.
      if (!session_known.pan) {
        return {
          status: "need_input",
          actions: [],
          needs_confirmation: false,
          needs_user_input: [
            {
              field: "pan",
              prompt:
                "I need your PAN to check the refund status. Please say or type your 10-character PAN (e.g. ABCDE1234F).",
            },
          ],
        };
      }

      const panFilled = Boolean(current_page.values.pan_input);
      const hasError = Boolean(current_page.field_errors.pan_input);

      // 2. Fill the form if not yet filled (or refilling after a correction).
      if (!panFilled || hasError) {
        const ay =
          input.task.entities.assessment_year || pickDefaultAY(input);
        return ready([
          {
            action: "fill",
            element_id: "pan_input",
            value_ref: "user.pan",
          },
          {
            action: "select",
            element_id: "assessment_year",
            value: ay,
          },
        ]);
      }

      // 3. Consequential action -> confirmation gate before submitting.
      return {
        status: "need_confirmation",
        needs_confirmation: true,
        confirmation_summary:
          "Submit the refund status request for the entered PAN and Assessment Year?",
        needs_user_input: [],
        actions: [{ action: "click", element_id: "submit_refund" }],
      };
    }

    case "result":
      return {
        status: "complete",
        actions: [{ action: "read", element_id: "refund_result" }],
        needs_confirmation: false,
        needs_user_input: [],
        message: "Refund status retrieved.",
      };

    default:
      return {
        status: "error",
        actions: [],
        needs_confirmation: false,
        needs_user_input: [],
        message: `No plan for state ${state}.`,
      };
  }
}

function pickDefaultAY(input: PlannerInput): string {
  const el = input.workflow.elements.assessment_year;
  const options = el?.options ?? ["2025-26"];
  // Default to the second-latest AY (most refunds are for the prior year).
  return options[1] ?? options[0];
}

function ready(actions: PlannerOutput["actions"]): PlannerOutput {
  return {
    status: "ready",
    actions,
    needs_confirmation: false,
    needs_user_input: [],
  };
}
