import { GoogleGenAI } from "@google/genai";

/**
 * Thin Gemini wrapper. Returns null when no API key is configured so callers
 * can fall back to the deterministic planner (keeps the demo working offline).
 */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function isGeminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * Ask Gemini for a strict-JSON response. Returns parsed JSON or throws.
 */
export async function geminiJSON(
  system: string,
  prompt: string
): Promise<unknown> {
  const ai = getClient();
  if (!ai) throw new Error("Gemini not configured");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Empty Gemini response");
  return JSON.parse(text);
}
