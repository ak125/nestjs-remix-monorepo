/**
 * Fiche fournisseur admin (mandat CH) — conversion du formulaire et appels API.
 *
 * Verrouille :
 *  - franco saisi en euros → centimes entiers, sans arrondi flottant ;
 *  - le corps envoyé ne contient que des clés connues du schéma backend,
 *    jamais « archive » ni une valeur de secret ;
 *  - la modification passe par PUT /api/suppliers/:id/card avec le cookie ;
 *  - un refus backend (409 doublon, 400 Zod) est affiché, pas transformé
 *    en succès ;
 *  - les actions de la fiche n'appellent que leurs routes dédiées ;
 *  - règles de remise (complément CH-2) : seules les clés du schéma partent,
 *    le retrait exige un id numérique, un 400 Zod est affiché par champ.
 */
import { type ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cardFormToBody,
  centsToEuros,
  eurosToCents,
  priceRuleFormToBody,
  readCardApiError,
} from "~/components/admin/suppliers/supplier-card";
import { action as cardAction } from "~/routes/admin.suppliers.$id";
import { action as editAction } from "~/routes/admin.suppliers.$id_.edit";

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

function post(path: string, fields: Record<string, string>): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    body: formOf(fields),
    headers: { Cookie: "connect.sid=abc" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("eurosToCents / centsToEuros", () => {
  it.each([
    ["150", 15000],
    ["150,5", 15050],
    ["150.50", 15050],
    ["0,07", 7],
    [" 1 200 ", 120000],
    ["", null],
  ])("%s → %s", (input, cents) => {
    expect(eurosToCents(input)).toBe(cents);
  });

  it.each(["-5", "12,345", "abc", "1e3"])("refuse %s", (input) => {
    expect(eurosToCents(input)).toBeUndefined();
  });

  it("aller-retour", () => {
    expect(centsToEuros(15050)).toBe("150,50");
    expect(centsToEuros(15000)).toBe("150");
    expect(centsToEuros(null)).toBe("");
  });
});

describe("cardFormToBody", () => {
  it("modification : statut archive jamais envoyé", () => {
    const r = cardFormToBody(
      formOf({ name: "DCA", status: "archive", francoEuros: "150" }),
      "update",
    );
    expect(r).toEqual({
      ok: true,
      body: { name: "DCA", francoHtCents: 15000 },
    });
  });

  it("création : statut ignoré, vides conservés pour effacement", () => {
    const r = cardFormToBody(
      formOf({ name: " DCA ", status: "actif", phone: "", francoEuros: "" }),
      "create",
    );
    expect(r).toEqual({
      ok: true,
      body: { name: "DCA", phone: "", francoHtCents: null },
    });
  });

  it("ignore les clés hors liste (aucune valeur de secret transmise)", () => {
    const r = cardFormToBody(
      formOf({ name: "DCA", secretName: "SUPPLIER_DCA", secretValue: "x" }),
      "update",
    );
    expect(r.ok && r.body).toEqual({ name: "DCA", secretName: "SUPPLIER_DCA" });
  });

  it("refuse un nom vide et un franco illisible", () => {
    const r = cardFormToBody(
      formOf({ name: " ", francoEuros: "abc" }),
      "update",
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual([
      "francoEuros",
      "name",
    ]);
  });
});

describe("readCardApiError", () => {
  it("400 Zod : erreurs par champ, franco renvoyé vers le champ en euros", () => {
    const e = readCardApiError(400, {
      message: "Validation failed",
      errors: [
        { field: "country", message: "Pays ISO 2" },
        { field: "francoHtCents", message: "Trop grand" },
      ],
    });
    expect(e.fieldErrors).toEqual({
      country: "Pays ISO 2",
      francoEuros: "Trop grand",
    });
  });

  it("409 doublon : liste des fiches", () => {
    const e = readCardApiError(409, {
      message: "Doublon",
      duplicates: [{ splId: "26", name: "DCA", kind: "exact", key: "dca" }],
    });
    expect(e.duplicates.map((d) => d.splId)).toEqual(["26"]);
  });
});

describe("action de modification", () => {
  it("PUT /api/suppliers/:id/card avec le cookie, puis retour à la fiche", async () => {
    const calls = stubFetch(200, { id: "71", possibleDuplicates: [] });
    const res = await editAction({
      request: post("/admin/suppliers/71/edit", { name: "DCA", city: "Lyon" }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/suppliers\/71\/card$/);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].headers.get("Cookie")).toBe("connect.sid=abc");
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({
      name: "DCA",
      city: "Lyon",
    });
    expect((res as Response).status).toBe(302);
    expect((res as Response).headers.get("Location")).toBe(
      "/admin/suppliers/71",
    );
  });

  it("409 affiché avec le statut, pas de redirection", async () => {
    stubFetch(409, { message: "Doublon", duplicates: [] });
    const res = (await editAction({
      request: post("/admin/suppliers/71/edit", { name: "JACKOPARTS" }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs)) as unknown as {
      data: { message: string };
      init: { status: number };
    };
    expect(res.init.status).toBe(409);
    expect(res.data.message).toBe("Doublon");
  });

  it("id non numérique refusé avant tout appel", async () => {
    const calls = stubFetch(200);
    await expect(
      editAction({
        request: post("/admin/suppliers/x/edit", { name: "DCA" }),
        params: { id: "../admin" },
        context,
      } as unknown as ActionFunctionArgs),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe("actions de la fiche", () => {
  it.each([
    ["validate-location", /\/api\/suppliers\/71\/location-validation$/],
    ["archive", /\/api\/suppliers\/71\/deactivate$/],
  ])("%s → route dédiée en POST", async (intent, url) => {
    const calls = stubFetch(200, { success: true });
    const res = await cardAction({
      request: post("/admin/suppliers/71", { intent }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(calls[0].url).toMatch(url);
    expect(calls[0].method).toBe("POST");
    expect(res).toMatchObject({ ok: true });
  });

  it("intention inconnue : aucun appel", async () => {
    const calls = stubFetch(200);
    const res = await cardAction({
      request: post("/admin/suppliers/71", { intent: "delete" }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(calls).toHaveLength(0);
    expect(res).toMatchObject({ init: { status: 400 } });
  });
});

describe("règles de remise (complément CH-2)", () => {
  it("priceRuleFormToBody : clés connues et non vides seulement", () => {
    expect(
      priceRuleFormToBody(
        formOf({
          intent: "add-price-rule",
          scopeLevel: "FAMILY",
          brandPmId: "1200",
          scopeCode: " NU17 ",
          remisePct: "32,5",
          margePct: "",
          effectiveFrom: "",
          active: "false",
        }),
      ),
    ).toEqual({
      scopeLevel: "FAMILY",
      brandPmId: "1200",
      scopeCode: "NU17",
      remisePct: "32,5",
    });
  });

  it("ajout : POST /price-rules avec le corps JSON et le cookie", async () => {
    const calls = stubFetch(201, { id: 99, version: 1 });
    const res = await cardAction({
      request: post("/admin/suppliers/71", {
        intent: "add-price-rule",
        scopeLevel: "BRAND",
        brandPmId: "1200",
        remisePct: "25",
      }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/suppliers\/71\/price-rules$/);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.get("Cookie")).toBe("connect.sid=abc");
    expect(calls[0].headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({
      scopeLevel: "BRAND",
      brandPmId: "1200",
      remisePct: "25",
    });
    expect(res).toMatchObject({ ok: true, message: "Règle enregistrée" });
  });

  it("ajout refusé (400 Zod) : message et erreurs par champ, pas de succès", async () => {
    stubFetch(400, {
      message: "Validation failed",
      errors: [{ field: "scopeCode", message: "Code requis" }],
    });
    const res = await cardAction({
      request: post("/admin/suppliers/71", {
        intent: "add-price-rule",
        scopeLevel: "FAMILY",
      }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(res).toMatchObject({
      data: { ok: false, fieldErrors: { scopeCode: "Code requis" } },
      init: { status: 400 },
    });
  });

  it("retrait : POST /price-rules/:ruleId/retire sans corps", async () => {
    const calls = stubFetch(200, { success: true, id: 5 });
    const res = await cardAction({
      request: post("/admin/suppliers/71", {
        intent: "retire-price-rule",
        ruleId: "5",
      }),
      params: { id: "71" },
      context,
    } as unknown as ActionFunctionArgs);
    expect(calls[0].url).toMatch(
      /\/api\/suppliers\/71\/price-rules\/5\/retire$/,
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toBeUndefined();
    expect(res).toMatchObject({ ok: true, message: "Règle retirée" });
  });

  it.each(["", "../card", "5/../../deactivate", "-1"])(
    "retrait avec ruleId %j : aucun appel, 400",
    async (ruleId) => {
      const calls = stubFetch(200);
      const res = await cardAction({
        request: post("/admin/suppliers/71", {
          intent: "retire-price-rule",
          ruleId,
        }),
        params: { id: "71" },
        context,
      } as unknown as ActionFunctionArgs);
      expect(calls).toHaveLength(0);
      expect(res).toMatchObject({ init: { status: 400 } });
    },
  );
});
