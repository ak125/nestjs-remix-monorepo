/**
 * Cartes véhicule R1 (MotorisationsSection, variant « R1 ») — chaque carte a un vrai
 * <a href> dans le rendu serveur, y compris celles au-delà des 12 du premier affichage.
 *
 * Avant le complément n° 12 au mandat DS, seules les 12 premières cartes étaient rendues ;
 * les suivantes n'existaient qu'après le clic sur « Voir les N autres compatibilités »
 * (constat DU, REFERENTIEL-EXTERNE.md, #2211 : 7 cartes sur 19 sans lien sur le filtre à huile).
 * Les cartes repliées sont désormais rendues avec la classe `hidden` et révélées par le bouton :
 * présentes dans le HTML, atteignables par le visiteur après le clic, jamais cachées autrement.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import MotorisationsSection from "~/components/pieces/MotorisationsSection";

afterEach(cleanup);

const ITEMS = Array.from({ length: 19 }, (_, i) => ({
  title: `VEHICULE ${i + 1}`,
  marque_name: "DACIA",
  modele_name: `MODELE${i + 1}`,
  type_name: "1.5 dCi",
  puissance: "68 ch",
  periode: "",
  type_year_from: "2008",
  type_year_to: "2012",
  image: "",
  link: `/pieces/filtre-a-huile-7/dacia-1/modele${i + 1}-1/1-5-dci-${i + 1}.html`,
  description: "",
  advice: "",
}));

const section = () => (
  <MemoryRouter initialEntries={["/pieces/filtre-a-huile-7.html"]}>
    <MotorisationsSection
      variant="R1"
      motorisations={{ title: "Motorisations", items: ITEMS }}
    />
  </MemoryRouter>
);

/** Cartes véhicule : <a href> contenant un titre h3 et « Voir les pièces ». */
const cartes = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(
    (a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent ?? ""),
  );
const repliee = (a: Element) => a.classList.contains("hidden");

describe("cartes véhicule R1 — lien dans le rendu serveur", () => {
  it("rend un <a href> pour chacune des 19 cartes, vers la même cible", () => {
    const doc = new DOMParser().parseFromString(
      renderToString(section()),
      "text/html",
    );
    const liens = cartes(doc).map((a) => a.getAttribute("href"));
    expect(liens).toEqual(ITEMS.map((m) => m.link));
  });

  it("premier affichage inchangé : 12 cartes visibles, 7 repliées, bouton « Voir les 7 autres »", () => {
    const doc = new DOMParser().parseFromString(
      renderToString(section()),
      "text/html",
    );
    const c = cartes(doc);
    expect(c.slice(0, 12).filter(repliee)).toHaveLength(0);
    expect(c.slice(12).every(repliee)).toBe(true);
    expect(doc.body.textContent).toContain("Voir les 7 autres compatibilités");
  });

  it("le bouton révèle les cartes repliées, puis les replie", () => {
    const { container } = render(section());
    expect(cartes(container).filter(repliee)).toHaveLength(7);
    fireEvent.click(
      screen.getByRole("button", { name: /Voir les 7 autres compatibilités/ }),
    );
    expect(cartes(container)).toHaveLength(19);
    expect(cartes(container).filter(repliee)).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: /Masquer les véhicules/ }),
    );
    expect(cartes(container).filter(repliee)).toHaveLength(7);
  });
});
