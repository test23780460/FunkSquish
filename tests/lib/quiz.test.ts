import { describe, expect, it } from "vitest";
import { isComplete, personalities, quizQuestions, recommend, scoreQuiz } from "@/lib/quiz";
import { previewProducts } from "@/commerce/providers/preview";
import { toProductSummary } from "@/commerce/summary";
import { TEXTURE_IDS } from "@/content/textures";
import { categories } from "@/commerce/categories";

/** Every combination of answers (small enough to brute-force). */
function* allAnswerSets(i = 0, acc: Record<string, string> = {}): Generator<Record<string, string>> {
  if (i === quizQuestions.length) return yield { ...acc };
  for (const o of quizQuestions[i].options) yield* allAnswerSets(i + 1, { ...acc, [quizQuestions[i].id]: o.id });
}

describe("personality quiz", () => {
  it("gives a valid result for every possible set of answers, and every result is reachable", () => {
    const textures = new Set<string>();
    const collections = new Set<string>();
    let n = 0;
    for (const answers of allAnswerSets()) {
      const r = scoreQuiz(answers);
      expect(personalities[r.texture]).toBeDefined();
      textures.add(r.texture);
      collections.add(r.collection);
      n++;
    }
    expect(n).toBeGreaterThan(1000);
    expect([...textures].sort()).toEqual([...TEXTURE_IDS].sort());
    expect([...collections].sort()).toEqual(categories.map((c) => c.slug).sort());
  });

  it("ignores unknown or tampered answers", () => {
    const r = scoreQuiz({ speed: "<script>", nope: "x" });
    expect(TEXTURE_IDS).toContain(r.texture);
    expect(isComplete({ speed: "pop" })).toBe(false);
  });

  it("an all-crunch run lands on Crunch Champion", () => {
    expect(scoreQuiz({ speed: "crunch", snack: "donut", sound: "snow", color: "lemon" }).texture).toBe("crunchy");
  });

  it("recommends real catalog items only, texture matches first", () => {
    const products = previewProducts.map(toProductSummary);
    const picks = recommend(products, "jelly", "fruity-slushies");
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].textures).toContain("jelly");
    for (const p of picks) expect(products).toContain(p);
    expect(recommend(products, "buttery", "cute-collectibles").every((p) => p.category === "cute-collectibles")).toBe(true);
  });

  it("uses no medical or mood claims in its copy", () => {
    const text = JSON.stringify({ quizQuestions, personalities }).toLowerCase();
    for (const word of ["anxiety", "stress relief", "therapy", "adhd", "calms", "heal", "medical"]) expect(text).not.toContain(word);
  });
});
