import { NextResponse } from "next/server";
import { geminiTranscribe, isGeminiEnabled } from "@/lib/planner/gemini";

// The Gemini SDK needs the Node.js runtime (not edge) and must read env vars at
// request time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranscribeBody {
  audio?: string; // base64 (no data: prefix)
  mimeType?: string;
  lang?: string;
}

export async function POST(req: Request) {
  if (!isGeminiEnabled()) {
    return NextResponse.json(
      { error: "transcription not available" },
      { status: 503 }
    );
  }

  let body: TranscribeBody;
  try {
    body = (await req.json()) as TranscribeBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.audio) {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }

  try {
    const text = await geminiTranscribe(
      body.audio,
      body.mimeType || "audio/webm",
      body.lang
    );
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    console.error("[transcribe] Gemini error:", message);
    return NextResponse.json(
      { error: `transcription failed: ${message}` },
      { status: 500 }
    );
  }
}
