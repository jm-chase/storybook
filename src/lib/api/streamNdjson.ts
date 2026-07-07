import type { GateProgress } from "../art/outputGate/runGate";

// NDJSON streaming for the long-running generate endpoints (W-3): one JSON
// object per line — {progress: GateProgress} events while the gate works,
// then exactly one terminal line: {done: <payload>} or {error: <message>}.
// Validation failures still return plain JSON 4xx BEFORE streaming starts;
// once the stream is open, errors travel in-body on HTTP 200.

export type NdjsonLine =
  | { progress: GateProgress }
  | { done: unknown }
  | { error: string };

export function streamNdjson(
  work: (emitProgress: (p: GateProgress) => void) => Promise<unknown>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: NdjsonLine) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      try {
        const result = await work((p) => send({ progress: p }));
        send({ done: result });
      } catch (e) {
        send({ error: (e as Error).message });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
