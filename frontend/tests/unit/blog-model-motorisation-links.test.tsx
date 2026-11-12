/**
 * Page modèle du blog (/blog-pieces-auto/auto/:marque/:modele) — liens vers les
 * fiches motorisation.
 *
 * La fiche motorisation est servie à /constructeurs/{marque}/{modele}/{alias}-{id}.html
 * et redirige en 301 toute autre écriture. Le lien doit donc porter l'alias que
 * l'API renvoie déjà (`slug`), pas l'identifiant seul.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import BlogPiecesAutoMarqueModele from "~/routes/blog-pieces-auto.auto.$marque.$modele";
import { normalizeTypeAlias } from "~/utils/url-builder.utils";

afterEach(cleanup);

type ApiType = {
  id: string;
  designation: string;
  slug: string | null;
  carburant: string;
  kw: number;
  ch: number;
  yearFrom: string | null;
  yearTo: string | null;
  monthFrom: string | null;
  monthTo: string | null;
};

const apiType = (overrides: Partial<ApiType>): ApiType => ({
  id: "15669",
  designation: "0.6",
  slug: "0-6",
  carburant: "Essence",
  kw: 40,
  ch: 55,
  yearFrom: "1998",
  yearTo: "2004",
  monthFrom: "7",
  monthTo: "1",
  ...overrides,
});

function renderPage(types: ApiType[]) {
  const brand = { id: 151, name: "SMART", alias: "smart", logo: null };
  const modelGroup = {
    id: 151001,
    name: "CITY-COUPE",
    alias: "city-coupe",
    imageUrl: null,
  };
  const Stub = createRoutesStub([
    {
      path: "/blog-pieces-auto/auto/:marque/:modele",
      Component: BlogPiecesAutoMarqueModele,
      HydrateFallback: () => null,
      loader: () => ({
        brand,
        modelGroup,
        models: [{ ...modelGroup, types }],
        metadata: null,
      }),
    },
  ]);
  return render(
    <Stub initialEntries={["/blog-pieces-auto/auto/smart/city-coupe"]} />,
  );
}

async function motorisationHrefs() {
  await screen.findAllByText(/Motorisations/);
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => /^\/constructeurs\/[^/]+\/[^/]+\//.test(href));
}

describe("page modèle du blog — liens vers les fiches motorisation", () => {
  it("lie l'adresse servie : alias de l'API suivi de l'identifiant", async () => {
    renderPage([
      apiType({ id: "15669", slug: "0-6" }),
      apiType({
        id: "32817",
        designation: "0.8 CDI",
        slug: "0-8-cdi",
        carburant: "Diesel",
      }),
    ]);

    expect(await motorisationHrefs()).toEqual([
      "/constructeurs/smart-151/city-coupe-151001/0-8-cdi-32817.html",
      "/constructeurs/smart-151/city-coupe-151001/0-6-15669.html",
    ]);
  });

  it("n'écrit plus l'identifiant seul, qui répond par une redirection", async () => {
    renderPage([apiType({}), apiType({ id: "9339" })]);

    const hrefs = await motorisationHrefs();

    expect(hrefs).toHaveLength(2);
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/\d+\.html$/);
    }
  });

  it("applique la règle de la fiche motorisation quand l'alias manque", async () => {
    renderPage([
      apiType({ id: "100", designation: "2.0 16V", slug: null }),
      apiType({ id: "101", designation: "1.9 TDI", slug: "" }),
      apiType({ id: "102", designation: "1.4 TSI", slug: "null" }),
      apiType({ id: "103", designation: "1.6 HDi", slug: "103" }),
    ]);

    expect(await motorisationHrefs()).toEqual([
      `/constructeurs/smart-151/city-coupe-151001/${normalizeTypeAlias(null, "2.0 16V")}-100.html`,
      `/constructeurs/smart-151/city-coupe-151001/${normalizeTypeAlias(null, "1.9 TDI")}-101.html`,
      `/constructeurs/smart-151/city-coupe-151001/${normalizeTypeAlias(null, "1.4 TSI")}-102.html`,
      `/constructeurs/smart-151/city-coupe-151001/${normalizeTypeAlias(null, "1.6 HDi")}-103.html`,
    ]);
  });

  it("n'affiche aucun lien de motorisation quand le modèle n'en a pas", async () => {
    renderPage([]);

    await screen.findAllByText(/SMART/);
    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href") ?? "")
        .filter((href) => /^\/constructeurs\/[^/]+\/[^/]+\//.test(href)),
    ).toEqual([]);
  });
});
