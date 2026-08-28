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

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

/**
 * Transcribe an audio clip via Gemini. Used as a speech-to-text fallback for
 * browsers where the Web Speech API can't reach Google's cloud service
 * (e.g. Brave). Returns the recognised text (may be empty for silence).
 */
export async function geminiTranscribe(
  base64Audio: string,
  mimeType: string,
  langHint?: string
): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error("Gemini not configured");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Transcribe this audio verbatim.${
              langHint ? ` The speaker is using ${langHint}.` : ""
            } The speaker may mix English and Hindi (Hinglish). Output ONLY the transcription text with no quotes, labels, or commentary. If there is no speech, output an empty string.`,
          },
          { inlineData: { mimeType, data: base64Audio } },
        ],
      },
    ],
    config: { temperature: 0 },
  });

  return (res.text ?? "").trim();
}
