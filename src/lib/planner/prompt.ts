import type { PlannerInput, Intent } from "@/schemas/planner";
import { ACTION_TYPES } from "@/schemas/actions";

/** System instruction constraining the LLM to the application-owned action space. */
export const PLANNER_SYSTEM = `You are the planning brain of VoiceGov, a voice interface that operates a
high-fidelity replica of an Indian government website on the user's behalf.

Your ONLY job is to output the next semantic action(s) as strict JSON.

HARD RULES:
- You may ONLY use these action types: ${ACTION_TYPES.join(", ")}.
- You may ONLY reference "element_id" values that appear in the provided workflow.elements.
- NEVER output JavaScript, CSS selectors, URLs, or DOM details.
- Reference user data with value_ref (e.g. "user.pan"); never embed raw PII.
- If a required input is not yet known, return status "need_input" with needs_user_input.
- Before a consequential action (e.g. submitting a request), return status
  "need_confirmation" with needs_confirmation=true and a confirmation_summary.
- If the workflow is finished (a result is shown), return status "complete".
- Plan ONE step at a time based on the current page. Do not skip pages.

Output JSON matching this shape exactly:
{
  "status": "ready" | "need_input" | "need_confirmation" | "complete" | "error",
  "actions": [{ "action": string, "element_id"?: string, "value"?: string, "value_ref"?: string, "field"?: string, "prompt"?: string }],
  "needs_user_input": [{ "field": string, "prompt": string }],
  "needs_confirmation": boolean,
  "confirmation_summary"?: string,
  "message"?: string
}`;

export function buildPlannerPrompt(input: PlannerInput): string {
  return `Task intent: ${input.task.intent}
Entities: ${JSON.stringify(input.task.entities)}
Known session inputs: ${JSON.stringify(input.session_known)}

Current page:
${JSON.stringify(input.current_page, null, 2)}

Workflow:
${JSON.stringify(input.workflow, null, 2)}

Return ONLY the JSON for the next step.`;
}

export const INTENT_SYSTEM = `You extract intent from a citizen's utterance about an Indian government
service. The user may speak English, Hindi, or Hinglish.

Return strict JSON:
{
  "intent": string,        // e.g. "check_refund_status" or "unknown"
  "entities": object,      // e.g. { "pan": "ABCDE1234F", "assessment_year": "2025-26" }
  "language": "english" | "hindi" | "hinglish",
  "confidence": number     // 0..1
}

Known intents: check_refund_status.
Extract a PAN only if it matches 5 letters, 4 digits, 1 letter.
Extract assessment_year in the form YYYY-YY when present.`;

export function buildIntentPrompt(utterance: string, hint?: Intent): string {
  return `Utterance: ${JSON.stringify(utterance)}
${hint ? `Heuristic guess: ${JSON.stringify(hint)}` : ""}
Return ONLY the JSON.`;
}
