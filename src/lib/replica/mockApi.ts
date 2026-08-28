/**
 * Mock backend for the Income Tax replica. Deterministic and repeatable.
 * Never contacts any real government system.
 */
export interface ResultRow {
  label: string;
  value: string;
}

/** Generic result shape rendered by the replica for any service. */
export interface ServiceResult {
  status: "success" | "warning" | "error";
  headline: string;
  detail: string;
  rows: ResultRow[];
}

/** Error carrying which form field caused it (for inline validation). */
export class FieldError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_REGEX = /^[0-9]{12}$/;

export function normalizePan(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
export function normalizeAadhaar(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const DEMO_PAN = "ABCDE1234F";
export const DEMO_AADHAAR = "234523452345";

// ---------------------------------------------------------------------------
// Refund status
// ---------------------------------------------------------------------------
const REFUNDS: Record<
  string,
  { status: ServiceResult["status"]; headline: string; detail: string; extra: ResultRow[] }
> = {
  ABCDE1234F: {
    status: "success",
    headline: "Refund Issued",
    detail:
      "Your refund has been credited to your registered bank account (A/C ****4821).",
    extra: [
      { label: "Refund Amount", value: "\u20B9 24,500" },
      { label: "Refund Mode", value: "ECS / Direct Credit" },
      { label: "Reference No.", value: "REF2026IT0098421" },
      { label: "Status As On", value: "12 Aug 2026" },
    ],
  },
  AAAPZ9012K: {
    status: "warning",
    headline: "Refund Under Process",
    detail:
      "Your return has been processed and the refund is awaiting release by the refund banker.",
    extra: [
      { label: "Reference No.", value: "REF2026IT0100233" },
      { label: "Status As On", value: "20 Aug 2026" },
    ],
  },
};

export async function checkRefundStatus(
  panRaw: string,
  assessmentYear: string
): Promise<ServiceResult> {
  const pan = normalizePan(panRaw);
  await delay(1100);

  if (!PAN_REGEX.test(pan)) {
    throw new FieldError(
      "pan",
      "Please enter a valid 10-character PAN (e.g. ABCDE1234F)."
    );
  }

  const base: ResultRow[] = [
    { label: "PAN", value: maskPan(pan) },
    { label: "Assessment Year", value: assessmentYear },
  ];

  const known = REFUNDS[pan];
  if (known) {
    return {
      status: known.status,
      headline: known.headline,
      detail: known.detail,
      rows: [...base, ...known.extra],
    };
  }

  return {
    status: "error",
    headline: "No Refund Records Found",
    detail:
      "No refund record was found for this PAN and Assessment Year. Please verify the details and try again.",
    rows: base,
  };
}

// ---------------------------------------------------------------------------
// Link Aadhaar
// ---------------------------------------------------------------------------
export async function checkAadhaarLink(
  panRaw: string,
  aadhaarRaw: string
): Promise<ServiceResult> {
  const pan = normalizePan(panRaw);
  const aadhaar = normalizeAadhaar(aadhaarRaw);
  await delay(1100);

  if (!PAN_REGEX.test(pan)) {
    throw new FieldError(
      "pan",
      "Please enter a valid 10-character PAN (e.g. ABCDE1234F)."
    );
  }
  if (!AADHAAR_REGEX.test(aadhaar)) {
    throw new FieldError(
      "aadhaar",
      "Please enter a valid 12-digit Aadhaar number."
    );
  }

  const rows: ResultRow[] = [
    { label: "PAN", value: maskPan(pan) },
    { label: "Aadhaar", value: maskAadhaar(aadhaar) },
  ];

  // Deterministic outcomes.
  if (pan === "ABCDE1234F") {
    return {
      status: "success",
      headline: "PAN is Already Linked with Aadhaar",
      detail:
        "Your PAN is already linked to the given Aadhaar number. No further action is required.",
      rows,
    };
  }
  if (aadhaar === "000000000000" || pan === "ZZZZZ0000Z") {
    return {
      status: "error",
      headline: "Linking Failed — Details Do Not Match",
      detail:
        "The name/date of birth on your PAN and Aadhaar do not match. Please correct the mismatch and try again.",
      rows,
    };
  }

  return {
    status: "success",
    headline: "Link Aadhaar Request Submitted",
    detail:
      "Your request to link PAN with Aadhaar has been accepted and is being processed. You can check the status after some time.",
    rows: [
      ...rows,
      { label: "Request ID", value: "AADH2026LK0045512" },
      { label: "Submitted On", value: "28 Aug 2026" },
    ],
  };
}

// ---------------------------------------------------------------------------
export function maskPan(pan: string): string {
  if (pan.length <= 4) return pan;
  return `${pan.slice(0, 3)}${"\u2022".repeat(pan.length - 4)}${pan.slice(-1)}`;
}
export function maskAadhaar(aadhaar: string): string {
  if (aadhaar.length <= 4) return aadhaar;
  return `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${aadhaar.slice(-4)}`;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
