import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/** Lazily construct a single Anthropic client. Throws if the key is missing. */
export function getClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (add it to .env.local).");
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

/** Model used for both the input classifier and the output moderation pass. */
export const MODEL = process.env.STORYBOOK_MODEL ?? "claude-opus-4-8";
