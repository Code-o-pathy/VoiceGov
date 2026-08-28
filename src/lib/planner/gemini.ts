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

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
// A cheaper/faster model used for high-frequency calls (STT + field interpret)
// to conserve the primary model's rate-limit quota. Falls back to MODEL.
const LITE_MODEL =
  process.env.GEMINI_LITE_MODEL || process.env.GEMINI_MODEL || "gemini-3.6-flash-lite";

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b429\b/.test(msg) ||
    /RESOURCE_EXHAUSTED/i.test(msg) ||
    /quota/i.test(msg) ||
    /rate limit/i.test(msg)
  );
}

/** Run a Gemini call, retrying transient rate-limit (429) errors with backoff. */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRateLimitError(err)) {
        const waitMs = 1200 * Math.pow(2, attempt); // 1.2s, 2.4s
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Ask Gemini for a strict-JSON response. Returns parsed JSON or throws.
 */
export async function geminiJSON(
  system: string,
  prompt: string
): Promise<unknown> {
  const ai = getClient();
  if (!ai) throw new Error("Gemini not configured");

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        temperature: 0,
      },
    })
  );

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

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: LITE_MODEL,
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
    })
  );

  return (res.text ?? "").trim();
}
