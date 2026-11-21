/**
 * Sources d'achat ordonnées par marque (mandat DQ) — formulaire et appels API.
 *
 * Verrouille :
 *  - le rang envoyé est la position triée par rang saisi, unique ;
 *  - une ligne sans fournisseur ou sans rang n'est pas une source ;
 *  - le surcoût saisi en euros part en centimes entiers (3 € → 300) ;
 *  - un point de livraison égal à la source n'est pas envoyé ;
 *  - l'écriture passe par PUT /api/suppliers/brands/:pmId/sources avec le
 *    cookie ; un refus backend est affiché, jamais transformé en succès ;
 *  - un pm_id non numérique est refusé avant tout appel ;
 *  - le repli hors dépôt de la fiche fait partie des champs envoyés.
 */
import { type ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  brandSourcesFormToBody,
  cardFormToBody,
} from "~/components/admin/suppliers/supplier-card";
import { action } from "~/routes/admin.suppliers.marques.$pmId";

vi.mock("~/auth/unified.server", () => ({
  requireUser: vi.fn(async () => ({ id: "u-admin", level: 9 })),
}));

const context = {} as unknown as ActionFunctionArgs["context"];

type Call = { url: string; method: string; headers: Headers; body?: string };

function stubFetch(status: number, body: unknown = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body as string | undefined,
      });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

function post(pmId: string, fields: Record<string, string>): Request {
  return new Request(`http://localhost:3000/admin/suppliers/marques/${pmId}`, {
    method: "POST",
    body: formOf(fields),
    headers: { Cookie: "connect.sid=abc" },
  });
}

/** Cas MEAT & DORIA : M&D (lien 97) saisi avant OTTOGO, rangs inversés. */
const MEAT_DORIA_FORM = {
  rowCount: "3",
  rank_0: "2",
  linkId_0: "97",
  splId_0: "45",
  deliverySplId_0: "21",
  stockKind_0: "commande",
  surcharge_0: "3",
  rank_1: "1",
  splId_1: "52",
  deliverySplId_1: "",
  stockKind_1: "stock",
  surcharge_1: "",
  rank_2: "",
  splId_2: "",
};

afterEach(() => vi.unstubAllGlobals());

describe("brandSourcesFormToBody", () => {
  it("MEAT & DORIA : OTTOGO puis M&D livré chez CS, 3 € → 300 c", () => {
    expect(brandSourcesFormToBody(formOf(MEAT_DORIA_FORM), 3)).toEqual({
      ok: true,
      body: {
        sources: [
          { splId: "52", stockKind: "stock", surchargeCents: 0 },
          {
            splId: "45",
            linkId: "97",
            deliverySplId: "21",
            stockKind: "commande",
            surchargeCents: 300,
          },
        ],
      },
    });
  });

  it("SASIC : deux lignes de la même source, livrées chez BG puis DCA", () => {
    const r = brandSourcesFormToBody(
      formOf({
        rank_0: "1",
        linkId_0: "75",
        splId_0: "59",
        deliverySplId_0: "15",
        stockKind_0: "stock",
        surcharge_0: "0",
        rank_1: "2",
        splId_1: "59",
        deliverySplId_1: "71",
        stockKind_1: "stock",
        surcharge_1: "0",
      }),
      2,
    );
    expect(r.ok && r.body.sources.map((s) => s.deliverySplId)).toEqual([
      "15",
      "71",
    ]);
  });

  it("ligne sans rang ou sans fournisseur : ignorée ; livraison = source : omise", () => {
    const r = brandSourcesFormToBody(
      formOf({
        rank_0: "",
        linkId_0: "41",
        splId_0: "19",
        stockKind_0: "stock",
        rank_1: "1",
        splId_1: "",
        rank_2: "1",
        splId_2: "20",
        deliverySplId_2: "20",
        stockKind_2: "commande",
        surcharge_2: "",
      }),
      3,
    );
    expect(r).toEqual({
      ok: true,
      body: {
        sources: [{ splId: "20", stockKind: "commande", surchargeCents: 0 }],
      },
    });
  });

  it("aucune ligne classée : liste vide (déclasse la marque)", () => {
    expect(brandSourcesFormToBody(formOf({ splId_0: "15" }), 1)).toEqual({
      ok: true,
      body: { sources: [] },
    });
  });

  it("refuse rang en double, rang illisible, nature absente, surcoût négatif", () => {
    const r = brandSourcesFormToBody(
      formOf({
        rank_0: "1",
        splId_0: "15",
        stockKind_0: "stock",
        rank_1: "1",
        splId_1: "52",
        stockKind_1: "stock",
        rank_2: "0",
        splId_2: "72",
        stockKind_2: "stock",
        rank_3: "3",
        splId_3: "21",
        stockKind_3: "",
        rank_4: "4",
        splId_4: "46",
        stockKind_4: "stock",
        surcharge_4: "-3",
      }),
      5,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual([
      "Ligne 2 : rang 1 déjà pris",
      "Ligne 3 : rang entier ≥ 1 attendu",
      "Ligne 4 : nature stock ou commande attendue",
      "Ligne 5 : surcoût en euros attendu (ex. 3 ou 3,50)",
    ]);
  });
});

describe("action des sources d'une marque", () => {
  it("PUT /api/suppliers/brands/:pmId/sources avec le cookie et la liste ordonnée", async () => {
    const calls = stubFetch(200, [{ linkId: "901", rank: 1, created: true }]);
    const res = await action({
      request: post("3030", MEAT_DORIA_FORM),
      params: { pmId: "3030" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(res).toEqual({ ok: true, message: "2 source(s) enregistrée(s)" });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toMatch(/\/api\/suppliers\/brands\/3030\/sources$/);
    expect(calls[0].headers.get("Cookie")).toBe("connect.sid=abc");
    expect(JSON.parse(calls[0].body ?? "{}").sources[1]).toEqual({
      splId: "45",
      linkId: "97",
      deliverySplId: "21",
      stockKind: "commande",
      surchargeCents: 300,
    });
  });

  it("400 backend (source non active) : affiché avec le statut, pas de succès", async () => {
    stubFetch(400, {
      message:
        "supplier_brand_sources_put: rang 1 : fournisseur 26 non actif (archive)",
    });
    const res = (await action({
      request: post("3030", MEAT_DORIA_FORM),
      params: { pmId: "3030" },
      context,
    } as unknown as ActionFunctionArgs)) as unknown as {
      init: { status: number };
      data: { ok: boolean; message: string };
    };
    expect(res.init.status).toBe(400);
    expect(res.data.ok).toBe(false);
    expect(res.data.message).toContain("non actif");
  });

  it("formulaire invalide : 400 sans appel au backend", async () => {
    const calls = stubFetch(200);
    const res = (await action({
      request: post("3030", { ...MEAT_DORIA_FORM, rank_1: "2" }),
      params: { pmId: "3030" },
      context,
    } as unknown as ActionFunctionArgs)) as unknown as {
      init: { status: number };
      data: { errors: string[] };
    };
    expect(res.init.status).toBe(400);
    expect(res.data.errors).toEqual(["Ligne 2 : rang 2 déjà pris"]);
    expect(calls).toHaveLength(0);
  });

  it("pm_id non numérique refusé avant tout appel", async () => {
    const calls = stubFetch(200);
    await expect(
      action({
        request: post("abc", MEAT_DORIA_FORM),
        params: { pmId: "abc" },
        context,
      } as unknown as ActionFunctionArgs),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe("repli hors dépôt de la fiche", () => {
  it("fallbackMode fait partie des champs envoyés", () => {
    const r = cardFormToBody(
      formOf({ name: "MGA", fallbackMode: "transporteur" }),
      "update",
    );
    expect(r.ok && r.body).toEqual({
      name: "MGA",
      fallbackMode: "transporteur",
    });
  });
});
