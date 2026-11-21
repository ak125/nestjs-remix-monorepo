/**
 * Mandat CL — panneau des équivalents d'une ligne en rupture.
 *
 * Ce test verrouille :
 * - l'équivalent s'affiche avec sa preuve, son achat daté et sa marge ;
 * - « Retenir » envoie exactement la pièce, le fournisseur et le prix affichés ;
 * - après le clic, le texte du mail est proposé à copier (aucun envoi) ;
 * - un équivalent à supplément n'a pas de bouton « Retenir ».
 *
 * Données inventées : aucune donnée client.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RuptureEquivalentsPanel } from "~/components/admin/RuptureEquivalentsPanel";

const BASE = "/api/admin/orders/CMD-TEST-1/lines/CMD-TEST-1-L001";

const equivalent = (o: Record<string, unknown> = {}) => ({
  pieceId: 9000002,
  marque: "PLAQUEX",
  ref: "PX 7777",
  statut: "RETENABLE",
  preuve: {
    reference: {
      oemCommunes: ["OE 111"],
      citeeParCommandee: true,
      citeCommandee: false,
    },
    typeVehicule: 99001,
    criteres: {
      compares: [
        {
          criId: "11",
          libelle: "Largeur",
          unite: "mm",
          commandee: ["120,1"],
          equivalent: ["120,2"],
          verdict: "PROCHE",
          bloquant: true,
          ecartMm: 0.1,
        },
      ],
      nonCompares: [],
      ecartTotalMm: 0.1,
      aVerifier: 0,
    },
  },
  achat: {
    splId: "12",
    fournisseur: "DCX DISTRIBUTION",
    prixAchatUnitHt: 24.21,
    prixAchatHt: 24.21,
    quantite: 1,
    origine: { type: "TARIF", dateTarif: "2022-06-01T00:00:00.000Z" },
  },
  margeAuPrixPaye: { unitHt: 21.11, totalHt: 21.11, taux: 0.466 },
  supplementTtc: 0,
  texteMail: {
    objet: "Votre commande CMD-TEST-1 : une solution disponible tout de suite",
    corps: "Bonjour,\n…immatriculation…",
  },
  ...o,
});

const vue = (o: Record<string, unknown> = {}) => ({
  statutLigne: "4",
  commandee: { marque: "FREINO", ref: "FR 00.0001-1" },
  toleranceMm: 0.5,
  sansRecherche: null,
  resultat: {
    equivalents: [
      equivalent(),
      equivalent({
        pieceId: 9000003,
        ref: "PX 8888",
        statut: "SUPPLEMENT_REQUIS",
        supplementTtc: 17.62,
      }),
    ],
    tronques: 0,
    ecartes: { CRITERES_DIFFERENTS: 2 },
  },
  fournisseurPose: false,
  retenu: null,
  ...o,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RuptureEquivalentsPanel", () => {
  it("affiche la preuve, l'achat daté, la marge, et retient l'équivalent affiché", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(vue()))
      .mockResolvedValueOnce(json({ success: true, retenu: {} }))
      .mockResolvedValueOnce(
        json(
          vue({
            fournisseurPose: true,
            retenu: {
              pieceId: 9000002,
              marque: "PLAQUEX",
              ref: "PX 7777",
              fournisseur: "DCX DISTRIBUTION",
              prixAchatUnitHt: 24.21,
              le: "2026-11-18T19:00:00.000Z",
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<RuptureEquivalentsPanel base={BASE} />);

    expect(await screen.findByText("PLAQUEX PX 7777")).toBeTruthy();
    expect(screen.getAllByText(/OE communes OE 111/)[0]).toBeTruthy();
    expect(screen.getAllByText(/écart 0.1 mm ≤ 0.5 mm/)[0]).toBeTruthy();
    expect(screen.getAllByText(/tarif du 01\/06\/2022/)[0]).toBeTruthy();
    expect(
      screen.getAllByText(/Marge au prix payé : 21.11 € HT/)[0],
    ).toBeTruthy();
    expect(screen.getByText(/Supplément 17.62 € TTC/)).toBeTruthy();
    expect(screen.getByText(/critères différents ×2/)).toBeTruthy();
    // un seul bouton : l'équivalent à supplément n'est pas retenable ici
    const boutons = screen.getAllByRole("button", {
      name: "Retenir cet équivalent",
    });
    expect(boutons).toHaveLength(1);

    fireEvent.click(boutons[0]);

    expect(await screen.findByText(/Équivalent retenu : PLAQUEX/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/retain-equivalent`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      pieceId: 9000002,
      splId: "12",
      prixAchatUnitHt: 24.21,
    });
    const texte = screen.getByLabelText(
      "Texte du mail client",
    ) as HTMLTextAreaElement;
    expect(texte.value).toContain("Objet : Votre commande CMD-TEST-1");
    expect(texte.value).toContain("immatriculation");
    expect(
      screen.queryByRole("button", { name: "Retenir cet équivalent" }),
    ).toBeNull();
  });

  it("affiche le refus du backend tel quel", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(vue()))
        .mockResolvedValueOnce(
          json(
            {
              message: {
                message: "L'équivalent a changé depuis son affichage",
              },
            },
            409,
          ),
        )
        .mockResolvedValueOnce(json(vue())),
    );
    render(<RuptureEquivalentsPanel base={BASE} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retenir cet équivalent" }),
    );
    expect(
      await screen.findByText("L'équivalent a changé depuis son affichage"),
    ).toBeTruthy();
  });

  it("sans véhicule sur la ligne, ne propose rien et le dit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json(vue({ sansRecherche: "TYPE_VEHICULE_INCONNU", resultat: null })),
        ),
    );
    render(<RuptureEquivalentsPanel base={BASE} />);
    expect(
      await screen.findByText(/Véhicule de la ligne inconnu/),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
