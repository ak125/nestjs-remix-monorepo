import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { GuideParts } from "~/components/guide/GuideParts";

afterEach(cleanup);

/**
 * Pages conseil, bloc « Pièces complémentaires » (S7).
 *
 * Défaut relevé le 2026-11-11 : les listes stockées portent des liens
 * `/pieces/{alias}` sans identifiant, et ces adresses répondent 410. Le
 * backend les résout en `/pieces/{alias}-{id}.html`, ou laisse le nom sans
 * lien quand aucune gamme du catalogue ne correspond. Le composant n'affiche
 * en lien que ce qui désigne une page servie.
 */
const section = (content: string) => ({
  title: "Pièces complémentaires",
  content,
  sectionType: "S7",
  order: 7,
  qualityScore: null,
  sources: [],
  anchor: "pieces-complementaires",
});

const renderParts = (content: string, pgAlias?: string, pgId?: number) =>
  render(
    <MemoryRouter>
      <GuideParts section={section(content)} pgAlias={pgAlias} pgId={pgId} />
    </MemoryRouter>,
  );

const hrefs = () =>
  screen.queryAllByRole("link").map((link) => link.getAttribute("href"));

describe("GuideParts — liens de gammes des pièces complémentaires", () => {
  it("lien résolu par le backend → carte cliquable vers la page de la gamme", () => {
    renderParts(
      '- <b><a href="/pieces/courroie-d-accessoire-10.html" class="seo-internal-link" data-link-type="LinkGamme">courroie d accessoire</a></b><br>' +
        '- <b><a href="/pieces/batterie-1.html" class="seo-internal-link" data-link-type="LinkGamme">batterie</a></b><br>',
    );

    expect(hrefs()).toEqual([
      "/pieces/courroie-d-accessoire-10.html",
      "/pieces/batterie-1.html",
    ]);
  });

  it("nom laissé sans lien par le backend → carte affichée, sans lien", () => {
    renderParts(
      '<b><a href="/pieces/batterie-1.html">batterie</a></b>' +
        '<b><span data-gamme-link="unresolved">calculateur moteur</span></b>',
    );

    expect(hrefs()).toEqual(["/pieces/batterie-1.html"]);
    expect(screen.getByText("calculateur moteur")).toBeTruthy();
    expect(screen.getByText("calculateur moteur").closest("a")).toBeNull();
  });

  it("libellé porté par du balisage → une carte, au nom sans balise", () => {
    renderParts(
      '<a href="/pieces/batterie-1.html" class="seo-internal-link"><strong>Batterie</strong></a>' +
        '<span data-gamme-link="unresolved"><b>Barillet de hayon</b></span>',
    );

    expect(hrefs()).toEqual(["/pieces/batterie-1.html"]);
    expect(screen.getByText("Batterie").closest("a")).not.toBeNull();
    expect(screen.getByText("Barillet de hayon").closest("a")).toBeNull();
  });

  it("contenu encore en cache, lien sans identifiant → nom affiché, jamais de lien en 410", () => {
    renderParts(
      '- <b><a href="/pieces/courroie-d-accessoire">courroie d accessoire</a></b><br>' +
        '- <b><a href="/pieces/demarreur.html">démarreur</a></b><br>' +
        '- <b><a href="/pieces/injecteur #LinkGamme_3902#">injecteur</a></b><br>',
    );

    expect(hrefs()).toEqual([]);
    for (const name of ["courroie d accessoire", "démarreur", "injecteur"]) {
      expect(screen.getByText(name).closest("a")).toBeNull();
    }
  });

  it("liens hors `/pieces/` et pages véhicule conservés", () => {
    renderParts(
      '<a href="/reference-auto/demarreur">définition du démarreur</a>' +
        '<a href="/pieces/demarreur-2/renault-140/clio-iii-140004/1-5-dci-19052.html">démarreur Clio</a>',
    );

    expect(hrefs()).toEqual([
      "/reference-auto/demarreur",
      "/pieces/demarreur-2/renault-140/clio-iii-140004/1-5-dci-19052.html",
    ]);
  });

  it("une pièce citée deux fois n'apparaît qu'une fois", () => {
    renderParts(
      '<a href="/pieces/batterie-1.html">batterie</a>' +
        '<a href="/pieces/batterie-1.html">batterie 12 V</a>' +
        '<span data-gamme-link="unresolved">Relais</span>' +
        '<span data-gamme-link="unresolved">relais</span>',
    );

    expect(hrefs()).toEqual(["/pieces/batterie-1.html"]);
    expect(screen.getAllByText(/relais/i)).toHaveLength(1);
  });

  it("aucune pièce dans le contenu → message, sans lien", () => {
    renderParts("<ul><li><strong>Batterie</strong> : à contrôler.</li></ul>");

    expect(
      screen.getByText("Aucune pièce complémentaire répertoriée."),
    ).toBeTruthy();
    expect(hrefs()).toEqual([]);
  });

  it("lien « toutes les pièces » construit par le résolveur canonique", () => {
    renderParts("", "demarreur", 2);

    expect(hrefs()).toEqual(["/pieces/demarreur-2.html"]);
  });

  it("lien « toutes les pièces » absent sans alias ou identifiant utilisable", () => {
    renderParts("", "demarreur", undefined);
    expect(hrefs()).toEqual([]);
    cleanup();

    renderParts("", undefined, 2);
    expect(hrefs()).toEqual([]);
    cleanup();

    renderParts("", "null", 2);
    expect(hrefs()).toEqual([]);
  });
});
