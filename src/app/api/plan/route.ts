import { NextResponse } from "next/server";
import { planLocal } from "@/lib/planner/mockPlanner";
import { geminiJSON, isGeminiEnabled } from "@/lib/planner/gemini";
import { PLANNER_SYSTEM, buildPlannerPrompt } from "@/lib/planner/prompt";
import { PlannerOutputSchema } from "@/schemas/actions";
import type { PlannerInput } from "@/schemas/planner";

export async function POST(req: Request) {
  let input: PlannerInput;
  try {
    input = (await req.json()) as PlannerInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!input?.task || !input?.current_page || !input?.workflow) {
    return NextResponse.json(
      { error: "invalid planner input" },
      { status: 400 }
    );
  }

  const fallback = planLocal(input);

  if (!isGeminiEnabled()) {
    return NextResponse.json({ ...fallback, source: "mock" });
  }

  try {
    const raw = await geminiJSON(PLANNER_SYSTEM, buildPlannerPrompt(input));
    // Validate the LLM output against our strict schema. If it fails, we do
    // NOT try to execute guessed behaviour — we fall back to deterministic.
    const parsed = PlannerOutputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ...fallback, source: "mock-fallback" });
    }
    return NextResponse.json({ ...parsed.data, source: "gemini" });
  } catch {
    return NextResponse.json({ ...fallback, source: "mock-fallback" });
  }
}
