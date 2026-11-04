import { describe, expect, it } from "vitest";
import { resolveSlogan } from "~/config/visual-intent";

/**
 * Régression — le hero des guides R3 affichait « Tout savoir sur les
 * filtre-a-huile » : la route conseils ne dispose que de pg_alias et le
 * gabarit l'interpolait tel quel (dossier filtre à huile, 2026-10-30).
 */
describe("resolveSlogan — guides R3", () => {
  it("ne produit aucun slogan à partir d'un alias d'URL", () => {
    expect(resolveSlogan("blog-conseil", "filtre-a-huile")).toBe("");
  });

  it("garde l'interpolation des autres intentions", () => {
    expect(resolveSlogan("diagnostic", "Filtre à huile")).toContain(
      "Filtre à huile",
    );
  });
});
