"use client";

/**
 * Synthetic session. Holds only mock/demo user data. PAN starts empty so the
 * demo can showcase missing-information handling (VoiceGov asks for it).
 */
export interface SessionUser {
  pan: string | null;
  assessment_year: string | null;
}

export interface SessionState {
  user: SessionUser;
}

let session: SessionState = {
  user: { pan: null, assessment_year: null },
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const sessionStore = {
  get(): SessionState {
    return session;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setPan(pan: string | null) {
    session = { ...session, user: { ...session.user, pan } };
    emit();
  },
  setAssessmentYear(ay: string | null) {
    session = {
      ...session,
      user: { ...session.user, assessment_year: ay },
    };
    emit();
  },
  reset() {
    session = { user: { pan: null, assessment_year: null } };
    emit();
  },
  /**
   * Resolve a value_ref like "user.pan" against the session.
   * Only application code does this — raw values never travel through the LLM.
   */
  resolveRef(ref: string): string | undefined {
    const path = ref.split(".");
    let cur: unknown = session;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in (cur as object)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return cur == null ? undefined : String(cur);
  },
};
