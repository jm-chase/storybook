import { validateField } from "../validation";
import { newId } from "./store";
import type { BookTemplate } from "../../content/bookTemplates";
import type { CastMember, StoryBeat } from "./types";

// Instantiate a book template (skin 2, D-023): authored cast + storyboard,
// with the parent-supplied hero woven in. The hero's name is validated like
// any name (shared with the story text); the hero's description is freeform
// art-only, same firewall as the studio (D-018).

export const MAX_HERO_DESCRIPTION = 300;

export interface TemplateInstance {
  title: string;
  cast: CastMember[];
  storyboard: StoryBeat[];
}

export type InstantiateResult =
  | { ok: true; value: TemplateInstance }
  | { ok: false; errors: Record<string, string> };

export function instantiateTemplate(
  template: BookTemplate,
  input: { heroName: unknown; heroDescription: unknown }
): InstantiateResult {
  const errors: Record<string, string> = {};

  const nameRes = validateField(input.heroName, "name", { required: true });
  let heroName = "";
  if (nameRes.ok) heroName = nameRes.value;
  else errors.heroName = nameRes.message;

  const heroDescription =
    typeof input.heroDescription === "string" ? input.heroDescription.replace(/\s+/g, " ").trim() : "";
  if (heroDescription.length === 0) {
    errors.heroDescription = "Describe your hero in a few words.";
  } else if (heroDescription.length > MAX_HERO_DESCRIPTION) {
    errors.heroDescription = `Keep the description under ${MAX_HERO_DESCRIPTION} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const hero: CastMember = { id: newId(), role: "hero", name: heroName, description: heroDescription };
  const others: CastMember[] = template.cast.map((c) => ({
    id: newId(),
    role: c.role,
    name: c.name,
    description: c.description,
  }));
  const idByName = new Map<string, string>([["hero", hero.id], ...others.map((c) => [c.name, c.id] as const)]);

  const fill = (s: string) => s.replaceAll("{hero}", heroName);

  const storyboard: StoryBeat[] = template.beats.map((b) => ({
    id: newId(),
    sceneDescription: fill(b.sceneDescription),
    text: fill(b.text),
    castIds: b.castNames.map((n) => {
      const id = idByName.get(n);
      if (!id) throw new Error(`template ${template.id}: beat references unknown cast name "${n}"`);
      return id;
    }),
  }));

  return {
    ok: true,
    value: { title: fill(template.title), cast: [hero, ...others], storyboard },
  };
}
