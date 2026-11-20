import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import GammeDiagnosticCTA from "~/components/gamme/GammeDiagnosticCTA";

afterEach(cleanup);

/**
 * Bouton « Lancer le diagnostic » des pages R1 (mandat DS, complément 6).
 *
 * Avant : texte blanc sur le dégradé orange-500 → orange-600 de Tailwind 4
 * (#ff6900 → #f54a00, hors jetons du site), pire rapport mesuré 2,75:1 à 390 px
 * au passage du reflet ; et un <button> placé dans le <a> du lien (HTML invalide).
 *
 * Après : un seul élément interactif, le lien stylé en bouton, avec les couleurs
 * du bouton de l'accueil (fond cta, texte noir, survol cta-hover).
 */
describe("GammeDiagnosticCTA — bouton du diagnostic", () => {
  function renderCta() {
    return render(
      <MemoryRouter>
        <GammeDiagnosticCTA />
      </MemoryRouter>,
    );
  }

  it("n'a qu'un élément interactif : le lien vers /diagnostic-auto", () => {
    const { container } = renderCta();

    const link = screen.getByRole("link", { name: /lancer le diagnostic/i });
    expect(link.getAttribute("href")).toBe("/diagnostic-auto");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(
      link.querySelectorAll(
        "a, button, input, select, textarea, [role=button], [tabindex]",
      ),
    ).toHaveLength(0);
  });

  it("emploie les jetons cta et le texte noir, sans le dégradé orange par défaut", () => {
    renderCta();

    const link = screen.getByRole("link", { name: /lancer le diagnostic/i });
    const classes = link.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining(["bg-cta", "hover:bg-cta-hover", "text-black"]),
    );
    expect(link.className).not.toMatch(/\btext-white\b/);
    expect(link.className).not.toMatch(/\b(from|to|shadow)-orange-\d+/);
  });

  it("garde le texte noir après visite : porte la classe no-visited", () => {
    // global.css applique text-purple-600 à `a:visited:not(.no-visited)`, plus spécifique que
    // text-black : sans cette classe, une fois /diagnostic-auto visité, le libellé passe au violet
    // sur l'orange (2,00:1 mesuré dans Chrome avec un historique réel, complément 7).
    renderCta();

    const link = screen.getByRole("link", { name: /lancer le diagnostic/i });
    expect(link.classList.contains("no-visited")).toBe(true);
  });
});
