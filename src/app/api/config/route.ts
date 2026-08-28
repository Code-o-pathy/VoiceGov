import { NextResponse } from "next/server";
import { isGeminiEnabled } from "@/lib/planner/gemini";

/** Exposes non-secret capability flags to the client (e.g. STT fallback). */
export async function GET() {
  return NextResponse.json({ gemini: isGeminiEnabled() });
}
