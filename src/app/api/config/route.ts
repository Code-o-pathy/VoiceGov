import { NextResponse } from "next/server";
import { isGeminiEnabled } from "@/lib/planner/gemini";

// Always evaluate at request time so the flag reflects the current environment
// variables (otherwise Next can cache a build-time value where the key was
// absent, and the client would never enable the Gemini STT fallback).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Exposes non-secret capability flags to the client (e.g. STT fallback). */
export async function GET() {
  return NextResponse.json(
    { gemini: isGeminiEnabled() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
