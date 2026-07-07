import { test } from "node:test";
import assert from "node:assert/strict";
import { beatsFromManuscript, MAX_MANUSCRIPT_PAGES } from "./fromManuscript";
import { MAX_PAGE_TEXT } from "./beats";

test("splits on blank lines, collapses whitespace, defaults sceneDescription", () => {
  const r = beatsFromManuscript("The bridge was old.\n\n\n“WHO goes there?”\r\n\r\nNobody   had asked before.");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.beats.length, 3);
    assert.equal(r.beats[1].text, "“WHO goes there?”");
    assert.equal(r.beats[2].text, "Nobody had asked before.");
    assert.equal(r.beats[0].sceneDescription, "The bridge was old.");
    assert.deepEqual(r.beats[0].castIds, []);
  }
});

test("rejects empty, oversize page, and too many pages", () => {
  assert.ok(!beatsFromManuscript("   ").ok);
  assert.ok(!beatsFromManuscript(undefined).ok);
  const long = beatsFromManuscript("x".repeat(MAX_PAGE_TEXT + 1));
  assert.ok(!long.ok);
  if (!long.ok) assert.match(long.error, /Page 1/);
  const many = beatsFromManuscript(Array(MAX_MANUSCRIPT_PAGES + 1).fill("page").join("\n\n"));
  assert.ok(!many.ok);
});
