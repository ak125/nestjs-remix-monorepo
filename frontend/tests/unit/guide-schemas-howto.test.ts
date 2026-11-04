import { describe, it, expect } from "vitest";

import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { buildGuideSchemas } from "~/components/guide/guide-schemas";

// FH-16 : le HowTo R3 ne déduit plus de durée du nombre d'étapes S4_DEPOSE.
describe("buildGuideSchemas — HowTo", () => {
  const article = {
    title: "Filtre à huile",
    meta_description: "Guide",
    publishedAt: "2026-10-30",
    keywords: [],
  };
  const depose = (n: number): GammeConseil => ({
    title: "Démontage",
    content: `<ol>${Array.from({ length: n }, (_, i) => `<li>Étape numéro ${i + 1}</li>`).join("")}</ol>`,
    sectionType: "S4_DEPOSE",
    order: 1,
    qualityScore: null,
    sources: [],
  });

  it.each([3, 6, 12])("%i étapes : étapes gardées, pas de totalTime", (n) => {
    const { howToSchema } = buildGuideSchemas(
      article,
      [depose(n)],
      "https://www.automecanik.com/blog-pieces-auto/conseils/filtre-a-huile",
    );
    expect(howToSchema).not.toBeNull();
    expect(howToSchema).not.toHaveProperty("totalTime");
    expect(howToSchema?.step).toHaveLength(n);
  });
});
