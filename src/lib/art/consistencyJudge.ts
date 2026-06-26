import Anthropic from "@anthropic-ai/sdk";

// Automated consistency signal for the spike: ask Claude (vision) whether a
// generated scene shows the SAME character as the reference sheet. Optional —
// only runs if ANTHROPIC_API_KEY is present. Forced-tool structured output.

export interface ConsistencyVerdict {
  sameCharacter: boolean;
  /** 1 (clearly different) … 5 (indistinguishable). */
  score: number;
  notes: string;
}

const TOOL: Anthropic.Tool = {
  name: "report_consistency",
  description: "Report whether the scene shows the same character as the reference.",
  input_schema: {
    type: "object",
    properties: {
      sameCharacter: { type: "boolean" },
      score: { type: "integer", description: "1=clearly different … 5=indistinguishable" },
      notes: { type: "string", description: "what matches / what drifted (face, colour, outfit, proportions)" },
    },
    required: ["sameCharacter", "score", "notes"],
  },
};

export async function judgeConsistency(
  referenceBase64: string,
  sceneBase64: string,
  mediaType = "image/png"
): Promise<ConsistencyVerdict> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const img = (data: string): Anthropic.ImageBlockParam => ({
    type: "image",
    source: { type: "base64", media_type: mediaType as "image/png", data },
  });

  const res = await client.messages.create({
    model: process.env.STORYBOOK_MODEL ?? "claude-opus-4-8",
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Image 1 is a character reference. Image 2 is a story scene. Is it the SAME character? Judge face, colours, outfit, and proportions." },
          img(referenceBase64),
          img(sceneBase64),
        ],
      },
    ],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("Judge returned no verdict.");
  return toolUse.input as ConsistencyVerdict;
}
