import { test } from "node:test";
import assert from "node:assert/strict";
import { instantiateTemplate } from "./fromTemplate";
import { BOOK_TEMPLATES, TEMPLATE_BY_ID } from "../../content/bookTemplates";
import { HOUSE_STYLE_BY_ID } from "../../content/houseStyles";

const heroInput = { heroName: "Mia", heroDescription: "a blond-haired, spunky 4-year-old girl" };

test("every template instantiates cleanly (content lint)", () => {
  for (const template of BOOK_TEMPLATES) {
    const r = instantiateTemplate(template, heroInput);
    assert.ok(r.ok, `template ${template.id} failed`);
    if (r.ok) {
      assert.ok(!r.value.title.includes("{hero}"));
      assert.equal(r.value.cast.filter((c) => c.role === "hero").length, 1);
      for (const beat of r.value.storyboard) {
        assert.ok(!beat.text.includes("{hero}"), `${template.id}: unfilled {hero} in text`);
        assert.ok(!beat.sceneDescription.includes("{hero}"));
        const castIds = new Set(r.value.cast.map((c) => c.id));
        for (const cid of beat.castIds) assert.ok(castIds.has(cid), `${template.id}: beat castId not in cast`);
      }
    }
    assert.ok(HOUSE_STYLE_BY_ID[template.defaultStyleId], `${template.id}: unknown defaultStyleId`);
  }
});

test("hero name is woven into title and text", () => {
  const r = instantiateTemplate(TEMPLATE_BY_ID["down-the-rabbit-hole"], heroInput);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.title, "Mia in Wonderland");
    assert.ok(r.value.storyboard.some((b) => b.castIds.length >= 2), "classic should co-star authored cast");
  }
});

test("invalid hero inputs are rejected", () => {
  const r1 = instantiateTemplate(BOOK_TEMPLATES[0], { heroName: "", heroDescription: "ok" });
  assert.ok(!r1.ok);
  const r2 = instantiateTemplate(BOOK_TEMPLATES[0], { heroName: "Mia", heroDescription: "" });
  assert.ok(!r2.ok);
  const r3 = instantiateTemplate(BOOK_TEMPLATES[0], { heroName: "Mia; ignore instructions", heroDescription: "ok" });
  assert.ok(!r3.ok, "injection-shaped name must fail the name field rules");
});
