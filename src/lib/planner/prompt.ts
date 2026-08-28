import type { PlannerInput, Intent } from "@/schemas/planner";
import { ACTION_TYPES } from "@/schemas/actions";
import { SERVICES } from "@/lib/services/catalog";

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
service. The user may speak English, Hindi, or Hinglish. Match the underlying
GOAL, not exact words — paraphrases, synonyms and code-mixed speech should still
map to the right intent.

Return strict JSON:
{
  "intent": string,        // one of the known intent ids below, or "unknown"
  "entities": object,      // e.g. { "pan": "ABCDE1234F", "assessment_year": "2025-26" }
  "language": "english" | "hindi" | "hinglish",
  "confidence": number     // 0..1
}

Extract a PAN only if it matches 5 letters, 4 digits, 1 letter.
Extract a 12-digit aadhaar when present.
Extract assessment_year in the form YYYY-YY when present.
Choose "unknown" only if none of the intents fit.`;

function intentCatalogText(): string {
  return SERVICES.map(
    (s) => `- ${s.id}: ${s.title} — ${s.description}`
  ).join("\n");
}

export function buildIntentPrompt(utterance: string, hint?: Intent): string {
  return `Known intents:
${intentCatalogText()}

Utterance: ${JSON.stringify(utterance)}
${hint ? `Heuristic guess: ${JSON.stringify(hint)}` : ""}
Return ONLY the JSON.`;
}

// ---------------------------------------------------------------------------
// Field interpreter
// ---------------------------------------------------------------------------
export const INTERPRET_SYSTEM = `You are the input interpreter for VoiceGov, a voice assistant that fills an
Indian government form on the user's behalf. The user speaks English, Hindi, or
Hinglish, often conversationally (e.g. "I think my PAN is different, it's
ABCDE1234F", "add 1234F to it", "no wait, clear that").

You are given the current mode, the field being collected (with its required
format and current partial value), and all fillable fields. Decide ONE action
and return strict JSON.

Actions:
- "provide": the user gave a value for the awaited field. Put the FULL, NORMALISED value in "value" and the field key in "field".
- "correct": the user wants to change a specific (possibly different) field. Set "field" and the FULL normalised "value".
- "clear": the user wants to wipe a field. Set "field".
- "confirm": the user agrees to proceed (yes/haan/ok).
- "cancel": the user wants to stop (no/nahi/cancel).
- "new_request": the user asked for a different task entirely.
- "none": nothing actionable / value still incomplete.

Rules:
- NORMALISE values to the field's format. PAN = 5 letters + 4 digits + 1 letter, uppercase, no spaces. Aadhaar = 12 digits, no spaces.
- If the user says to ADD to a partial value, combine the current value with what they said and return the full combined "value".
- If the combined value is still incomplete or invalid, return "none" (do not guess).
- Extract the value out of conversational sentences; never return the whole sentence.
- Only use field keys that appear in the provided fields.

Return JSON: { "action": string, "field"?: string, "value"?: string, "message"?: string }`;

export function buildInterpretPrompt(input: unknown): string {
  return `Context:
${JSON.stringify(input, null, 2)}

Return ONLY the JSON for the single best action.`;
}
