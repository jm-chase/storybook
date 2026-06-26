import { test } from "node:test";
import assert from "node:assert/strict";

import { runGate } from "./runGate";
import type { GateContext, ImageCandidate, ImageCheck, CheckResult } from "./types";

const ctx = {} as GateContext; // checks here don't read ctx

/** A generator that yields candidates labelled "0","1","2",… in base64. */
function sequentialGenerator() {
  let i = 0;
  return async (): Promise<ImageCandidate> => ({
    base64: String(i++),
    mimeType: "image/png",
  });
}

/** A check that passes/fails based on a predicate over the candidate's label. */
function check(name: string, pass: (label: string) => boolean): ImageCheck {
  return {
    name,
    async run(candidate): Promise<CheckResult> {
      return pass(candidate.base64)
        ? { check: name, status: "pass" }
        : { check: name, status: "fail", reason: `rejected ${candidate.base64}` };
    },
  };
}

test("collects exactly variantsWanted clean variants when everything passes", async () => {
  const out = await runGate(sequentialGenerator(), [check("ok", () => true)], ctx, {
    variantsWanted: 3,
    maxAttempts: 10,
  });
  assert.equal(out.variants.length, 3);
  assert.equal(out.attempts, 3);
  assert.equal(out.satisfied, true);
  assert.equal(out.rejected.length, 0);
});

test("rerolls past failures (e.g. a '3-hands' defect) until clean variants are found", async () => {
  // Reject the first two candidates ("0","1"); accept the rest.
  const out = await runGate(
    sequentialGenerator(),
    [check("quality", (l) => Number(l) >= 2)],
    ctx,
    { variantsWanted: 3, maxAttempts: 10 }
  );
  assert.equal(out.variants.map((v) => v.base64).join(","), "2,3,4");
  assert.equal(out.attempts, 5); // 2 rejected + 3 accepted
  assert.equal(out.rejected.length, 2);
  assert.equal(out.satisfied, true);
});

test("respects the maxAttempts budget and reports unsatisfied", async () => {
  const out = await runGate(sequentialGenerator(), [check("never", () => false)], ctx, {
    variantsWanted: 3,
    maxAttempts: 4,
  });
  assert.equal(out.variants.length, 0);
  assert.equal(out.attempts, 4);
  assert.equal(out.satisfied, false);
  assert.equal(out.rejected.length, 4);
});

test("a candidate is rejected if ANY check fails (all checks must pass)", async () => {
  const out = await runGate(
    sequentialGenerator(),
    [check("safety", () => true), check("quality", (l) => Number(l) !== 0)],
    ctx,
    { variantsWanted: 1, maxAttempts: 5 }
  );
  // "0" fails quality; "1" passes both.
  assert.equal(out.variants[0].base64, "1");
  assert.equal(out.rejected[0].failures[0].check, "quality");
});
