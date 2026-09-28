import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PiecesBuyingGuide } from "~/components/pieces/PiecesBuyingGuide";

describe("PiecesBuyingGuide — absence de contenu", () => {
  it("ne rend aucun bloc ni conseil par défaut quand la source est vide", () => {
    const html = renderToStaticMarkup(
      <PiecesBuyingGuide
        guide={{ title: "Guide d'achat", content: " ", tips: [], warnings: [] }}
      />,
    );
    expect(html).toBe("");
  });

  it("affiche le contenu fourni quand il existe", () => {
    const html = renderToStaticMarkup(
      <PiecesBuyingGuide
        guide={{
          title: "Choisir la référence",
          content: "Comparer le connecteur à deux broches.",
          tips: ["Vérifier la référence OEM."],
        }}
      />,
    );
    expect(html).toContain("Comparer le connecteur à deux broches.");
    expect(html).toContain("Vérifier la référence OEM.");
  });
});
