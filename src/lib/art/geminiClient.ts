import { GoogleGenAI } from "@google/genai";

// Single shared Gemini client — used by both image generation (geminiProvider)
// and the Output Gate's vision checks (outputGate/checks). Server-side only;
// the key never reaches the browser.

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (add it to .env.local).");
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}
