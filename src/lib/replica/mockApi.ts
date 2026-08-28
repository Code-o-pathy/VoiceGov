/**
 * Mock backend for the demo replica. Deterministic and repeatable.
 * Never contacts any real government or production system.
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
export const TAN_REGEX = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

export function normalizePan(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
export function normalizeAadhaar(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const DEMO_PAN = "ABCDE1234F";
export const DEMO_AADHAAR = "234523452345";

/** Realistic backend latency for the demo. */
export function serviceDelay(): Promise<void> {
  return delay(1100);
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
