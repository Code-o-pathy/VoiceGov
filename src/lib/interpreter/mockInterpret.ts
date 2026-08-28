import type { InterpretInput, InterpretOutput } from "@/schemas/interpret";
import { parsePan, parseAadhaar } from "@/lib/interpreter/fieldParse";

const YES = /\b(yes|yeah|yep|yup|ok|okay|okey|confirm|confirmed|proceed|go ahead|sure|haan|haa|ha|sahi|theek|thik|kar do|karo|submit|done)\b/i;
const NO = /\b(no|nope|nahi|nahin|cancel|stop|ruk|ruko|mat|don'?t|abort|wait)\b/i;
const CLEAR = /\b(clear|wipe|reset|remove|erase|delete|hata|mita|dobara|dubara|firse|phir se|redo|start over|restart|naya|new|change it|different|galat|wrong|incorrect)\b/i;
const APPEND = /\b(add|append|aur|and|plus|jodo|continue|rest|baaki|bacha)\b/i;

/**
 * Deterministic fallback for the field interpreter. Handles the common cases
 * (set / append / clear / correct / confirm / cancel) using keyword cues and
 * value extraction. The LLM route mirrors and extends this behaviour.
 */
export function interpretLocal(input: InterpretInput): InterpretOutput {
  const u = input.utterance;
  const lower = u.toLowerCase();

  if (input.mode === "awaiting_confirmation") {
    if (NO.test(lower)) return { action: "cancel" };
    const corr = detectCorrection(input, u, lower);
    if (corr) return corr;
    if (YES.test(lower)) return { action: "confirm" };
    return { action: "none" };
  }

  // awaiting_input --------------------------------------------------------
  const awaited = input.awaited;
  if (!awaited) return { action: "none" };

  // Which field does this concern? Default to the awaited one, unless another
  // named field is mentioned (e.g. "my aadhaar is ...").
  const targetKey = mentionedField(input, lower) ?? awaited.key;
  const isAwaited = targetKey === awaited.key;

  if (CLEAR.test(lower) && !hasValueToken(u)) {
    return { action: "clear", field: targetKey };
  }

  const append = APPEND.test(lower) && isAwaited;
  const base = append ? awaited.current : "";
  const value = buildValue(targetKey, base, u);

  if (value) {
    return {
      action: isAwaited ? "provide" : "correct",
      field: targetKey,
      value,
    };
  }
  return { action: "none", message: "No complete value found yet." };
}

function detectCorrection(
  input: InterpretInput,
  original: string,
  lower: string
): InterpretOutput | null {
  const key = mentionedField(input, lower);
  if (!key) {
    // No field named, but maybe a bare value was spoken.
    for (const f of input.fields) {
      const v = buildValue(f.key, "", original);
      if (v) return { action: "correct", field: f.key, value: v };
    }
    return null;
  }
  const v = buildValue(key, "", original);
  if (v) return { action: "correct", field: key, value: v };
  return null;
}

function mentionedField(input: InterpretInput, lower: string): string | null {
  for (const f of input.fields) {
    if (f.key === "pan" && /\bpan\b/.test(lower)) return "pan";
    if (f.key === "aadhaar" && /\b(aadhaar|aadhar|adhaar|adhar)\b/.test(lower))
      return "aadhaar";
  }
  return null;
}

/** True if the utterance seems to carry an actual value (letters+digits run). */
function hasValueToken(u: string): boolean {
  return /[a-z].*\d|\d.*[a-z]|\d{4,}/i.test(u.replace(/\s+/g, " "));
}

/** Compose and normalise the resulting full value for a field key. */
function buildValue(key: string, base: string, text: string): string | null {
  const combined = base ? `${base} ${text}` : text;
  if (key === "pan") return parsePan(combined);
  if (key === "aadhaar") return parseAadhaar(combined);
  const t = text.trim();
  return t.length > 0 ? t : null;
}
