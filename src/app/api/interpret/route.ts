import { NextResponse } from "next/server";
import { interpretLocal } from "@/lib/interpreter/mockInterpret";
import { geminiJSON, isGeminiEnabled } from "@/lib/planner/gemini";
import { INTERPRET_SYSTEM, buildInterpretPrompt } from "@/lib/planner/prompt";
import { InterpretOutputSchema } from "@/schemas/interpret";
import type { InterpretInput } from "@/schemas/interpret";

export async function POST(req: Request) {
  let input: InterpretInput;
  try {
    input = (await req.json()) as InterpretInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!input?.utterance || !input?.mode) {
    return NextResponse.json({ error: "invalid interpret input" }, { status: 400 });
  }

  const fallback = interpretLocal(input);

  if (!isGeminiEnabled()) {
    return NextResponse.json({ ...fallback, source: "mock" });
  }

  try {
    const raw = await geminiJSON(INTERPRET_SYSTEM, buildInterpretPrompt(input));
    const parsed = InterpretOutputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ...fallback, source: "mock-fallback" });
    }
    return NextResponse.json({ ...parsed.data, source: "gemini" });
  } catch {
    return NextResponse.json({ ...fallback, source: "mock-fallback" });
  }
}
