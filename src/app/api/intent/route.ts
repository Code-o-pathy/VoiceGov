import { NextResponse } from "next/server";
import { parseIntentLocal } from "@/lib/intent/mockIntent";
import { geminiJSON, isGeminiEnabled } from "@/lib/planner/gemini";
import { INTENT_SYSTEM, buildIntentPrompt } from "@/lib/planner/prompt";
import type { Intent } from "@/schemas/planner";

export async function POST(req: Request) {
  let body: { utterance?: string };
  try {
    body = (await req.json()) as { utterance?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { utterance } = body;
  if (!utterance || typeof utterance !== "string") {
    return NextResponse.json(
      { error: "utterance required" },
      { status: 400 }
    );
  }

  const heuristic = parseIntentLocal(utterance);

  if (!isGeminiEnabled()) {
    return NextResponse.json({ ...heuristic, source: "mock" });
  }

  try {
    const raw = (await geminiJSON(
      INTENT_SYSTEM,
      buildIntentPrompt(utterance, heuristic)
    )) as Partial<Intent>;

    const intent: Intent = {
      intent: raw.intent || heuristic.intent,
      entities: { ...heuristic.entities, ...(raw.entities || {}) },
      language: raw.language || heuristic.language,
      confidence:
        typeof raw.confidence === "number"
          ? raw.confidence
          : heuristic.confidence,
    };
    return NextResponse.json({ ...intent, source: "gemini" });
  } catch {
    return NextResponse.json({ ...heuristic, source: "mock-fallback" });
  }
}
