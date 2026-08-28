import type { Intent } from "@/schemas/planner";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  normalizePan,
  normalizeAadhaar,
} from "@/lib/replica/mockApi";

const HINGLISH_MARKERS = [
  "mujhe",
  "mera",
  "meri",
  "apna",
  "apni",
  "karna",
  "karni",
  "chahiye",
  "check",
  "hai",
  "kaise",
  "batao",
  "dikhao",
  "karo",
  "karado",
];

const REFUND_MARKERS = [
  "refund",
  "return",
  "paisa",
  "paise",
  "status",
  "wapas",
  "vapas",
];

const AADHAAR_MARKERS = ["aadhaar", "aadhar", "adhaar", "adhar", "आधार"];

/**
 * Deterministic intent extraction used as an offline fallback and as the
 * baseline the LLM route mirrors. Understands English, Hindi, and Hinglish.
 */
export function parseIntentLocal(utteranceRaw: string): Intent {
  const utterance = utteranceRaw.trim();
  const lower = utterance.toLowerCase();

  const language = detectLanguage(utterance, lower);
  const entities = extractEntities(utterance);

  // Aadhaar linking (checked first: "link aadhaar" is distinctive).
  if (AADHAAR_MARKERS.some((m) => lower.includes(m))) {
    return { intent: "link_aadhaar", entities, language, confidence: 0.95 };
  }

  if (REFUND_MARKERS.some((m) => lower.includes(m))) {
    return {
      intent: "check_refund_status",
      entities,
      language,
      confidence: 0.95,
    };
  }

  return { intent: "unknown", entities, language, confidence: 0.3 };
}

export function extractEntities(utterance: string): Record<string, string> {
  const entities: Record<string, string> = {};

  // PAN: 5 letters, 4 digits, 1 letter (allow spaces between blocks).
  const panMatch = utterance.toUpperCase().match(/[A-Z]{5}\s?[0-9]{4}\s?[A-Z]/);
  if (panMatch) {
    const pan = normalizePan(panMatch[0]);
    if (PAN_REGEX.test(pan)) entities.pan = pan;
  }

  // Aadhaar: 12 digits, possibly grouped (e.g. "2345 2345 2345").
  const aadhaarMatch = utterance.match(/\b\d(?:[\d\s]{10,14})\d\b/);
  if (aadhaarMatch) {
    const aadhaar = normalizeAadhaar(aadhaarMatch[0]);
    if (AADHAAR_REGEX.test(aadhaar)) entities.aadhaar = aadhaar;
  }

  // Assessment year: "2025-26", "2025 26", or a bare year.
  const ayRange = utterance.match(/20(2[3-9])\s*[-/]\s*(2[0-9])/);
  if (ayRange) {
    entities.assessment_year = `20${ayRange[1]}-${ayRange[2]}`;
  } else {
    const yearMatch = utterance.match(/\b20(2[3-9])\b/);
    if (yearMatch) {
      const start = Number(`20${yearMatch[1]}`);
      const end = String((start + 1) % 100).padStart(2, "0");
      entities.assessment_year = `${start}-${end}`;
    }
  }

  return entities;
}

function detectLanguage(original: string, lower: string): Intent["language"] {
  if (/[\u0900-\u097F]/.test(original)) return "hindi";
  if (HINGLISH_MARKERS.some((m) => lower.includes(m))) return "hinglish";
  return "english";
}
