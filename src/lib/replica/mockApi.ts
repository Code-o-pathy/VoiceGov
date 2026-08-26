/**
 * Mock backend for the Income Tax replica. Deterministic and repeatable.
 * Never contacts any real government system.
 */
export interface RefundResult {
  status: "issued" | "under_process" | "no_records";
  pan: string;
  assessment_year: string;
  headline: string;
  detail: string;
  amount?: string;
  mode?: string;
  reference_no?: string;
  date?: string;
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Deterministic mock results keyed by PAN. */
const KNOWN: Record<string, Omit<RefundResult, "pan" | "assessment_year">> = {
  ABCDE1234F: {
    status: "issued",
    headline: "Refund Issued",
    detail:
      "Your refund has been credited to your registered bank account (A/C ****4821).",
    amount: "\u20B9 24,500",
    mode: "ECS / Direct Credit",
    reference_no: "REF2026IT0098421",
    date: "12 Aug 2026",
  },
  AAAPZ9012K: {
    status: "under_process",
    headline: "Refund Under Process",
    detail:
      "Your return has been processed and the refund is awaiting release by the refund banker.",
    reference_no: "REF2026IT0100233",
    date: "20 Aug 2026",
  },
};

export const DEMO_PAN = "ABCDE1234F";

/**
 * Simulate the "Know Your Refund Status" service call.
 * Throws for invalid PAN format (surfaces as an inline validation error).
 */
export async function checkRefundStatus(
  panRaw: string,
  assessmentYear: string
): Promise<RefundResult> {
  const pan = normalizePan(panRaw);
  await delay(1100); // realistic latency

  if (!PAN_REGEX.test(pan)) {
    const err = new Error("Please enter a valid 10-character PAN (e.g. ABCDE1234F).");
    (err as Error & { code?: string }).code = "INVALID_PAN";
    throw err;
  }

  const known = KNOWN[pan];
  if (known) {
    return { ...known, pan, assessment_year: assessmentYear };
  }

  // Valid format but not in our records -> recoverable "no records" state.
  return {
    status: "no_records",
    pan,
    assessment_year: assessmentYear,
    headline: "No Refund Records Found",
    detail:
      "No refund record was found for this PAN and Assessment Year. Please verify the details and try again.",
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
