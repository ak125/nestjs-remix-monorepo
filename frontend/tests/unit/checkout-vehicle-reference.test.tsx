import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, type ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutPaiementSection } from "~/components/checkout/CheckoutPaiementSection";
import { COMPATIBILITY_NOTICE } from "~/components/checkout/compatibility-notice";
import { action } from "~/routes/checkout";
import {
  parseCheckoutFormData,
  vehicleReferenceSchema,
} from "~/schemas/checkout.schemas";
import { buildVehicleCheckPayload } from "~/services/order.server";

/**
 * Mandat BN (2026-11-17) — champ facultatif « Immatriculation, VIN ou
 * référence de la pièce » à l'étape livraison, et texte de compatibilité vrai.
 */

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("vehicleReferenceSchema", () => {
  it("accepte le champ vide (facultatif)", () => {
    expect(vehicleReferenceSchema.parse("")).toBe("");
    expect(vehicleReferenceSchema.parse("   ")).toBe("");
  });

  it("accepte une immatriculation, un VIN ou une référence, normalisés", () => {
    expect(vehicleReferenceSchema.parse("  ab-123-cd ")).toBe("ab-123-cd");
    expect(vehicleReferenceSchema.parse("VF1BB05CF12345678")).toBe(
      "VF1BB05CF12345678",
    );
    expect(vehicleReferenceSchema.parse("0 986  494 053")).toBe(
      "0 986 494 053",
    );
  });

  it("refuse les caractères hors liste et les valeurs trop longues", () => {
    expect(vehicleReferenceSchema.safeParse("<script>").success).toBe(false);
    expect(vehicleReferenceSchema.safeParse("-AB123").success).toBe(false);
    expect(vehicleReferenceSchema.safeParse("A".repeat(41)).success).toBe(
      false,
    );
  });

  it("parseCheckoutFormData lit vehicleReference (absent = vide)", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      guestEmail: "client@example.com",
      firstName: "Jean",
      lastName: "Testeur",
      address: "12 rue de la Paix",
      zipCode: "75001",
      city: "Paris",
      phone: "0601020304",
      acceptTerms: "on",
    }))
      fd.set(k, v);
    const empty = parseCheckoutFormData(fd);
    expect(empty.success && empty.data.vehicleReference).toBe("");
    fd.set("vehicleReference", "AB-123-CD");
    const filled = parseCheckoutFormData(fd);
    expect(filled.success && filled.data.vehicleReference).toBe("AB-123-CD");
  });
});

describe("buildVehicleCheckPayload", () => {
  it("sans véhicule : référence seule", () => {
    expect(buildVehicleCheckPayload("", null)).toEqual({
      customerReference: "",
      purchaseVehicle: null,
    });
  });

  it("véhicule du cookie : type_id + libellés", () => {
    expect(
      buildVehicleCheckPayload("AB-123-CD", {
        type_id: 33300,
        marque_name: "Renault",
        modele_name: "Clio III",
        type_name: "1.5 dCi",
      }),
    ).toEqual({
      customerReference: "AB-123-CD",
      purchaseVehicle: {
        typeId: 33300,
        brand: "Renault",
        model: "Clio III",
        engine: "1.5 dCi",
      },
    });
  });

  it("type_id invalide : pas de véhicule (pas de devinette)", () => {
    expect(
      buildVehicleCheckPayload("", { type_id: "abc", marque_name: "Renault" })
        .purchaseVehicle,
    ).toBeNull();
  });
});

function stubFetch() {
  const posted: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/cart")) {
        return new Response(
          JSON.stringify({
            user_id: "guest-session",
            items: [
              {
                id: "i1",
                product_id: "12345",
                product_name: "Plaquettes de frein",
                product_sku: "REF-123",
                quantity: 1,
                price: 62.35,
                type_id: 33300,
              },
            ],
            totals: { total_items: 1, total: 62.35, subtotal: 62.35 },
            metadata: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/orders/guest") && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            ord_id: "ORD-42",
            ord_total_ttc: "62.35",
            ord_is_pay: "0",
            customer: { cst_mail: "client@example.com" },
            resumeToken: "tok-1",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Fetch inattendu: ${url}`);
    }),
  );
  return posted;
}

function makeRequest(extra: Record<string, string>, cookie = "") {
  const form = new FormData();
  form.set("guestEmail", "client@example.com");
  form.set("civility", "M.");
  form.set("firstName", "Jean");
  form.set("lastName", "Testeur");
  form.set("address", "12 rue de la Paix");
  form.set("zipCode", "75001");
  form.set("city", "Paris");
  form.set("country", "France");
  form.set("phone", "0601020304");
  form.set("paymentMethod", "cyberplus");
  form.set("acceptTerms", "on");
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return new Request("http://localhost/checkout", {
    method: "POST",
    headers: { Cookie: `connect.sid=abc${cookie ? `; ${cookie}` : ""}` },
    body: form,
  });
}

const contextStub = {
  get: () => undefined,
} as unknown as ActionFunctionArgs["context"];

async function runAction(request: Request) {
  return (await action({
    request,
    context: contextStub,
    params: {},
  } as ActionFunctionArgs)) as Record<string, unknown>;
}

describe("checkout action — vehicleCheck transmis à la création", () => {
  it("champ vide accepté : commande créée, référence vide transmise", async () => {
    const posted = stubFetch();
    const result = await runAction(makeRequest({}));
    expect(result).toMatchObject({ ok: true, orderId: "ORD-42" });
    expect(posted[0].vehicleCheck).toEqual({
      customerReference: "",
      purchaseVehicle: null,
    });
  });

  it("référence + cookie véhicule : transmis au backend", async () => {
    const posted = stubFetch();
    const cookie = `selected_vehicle=${encodeURIComponent(
      JSON.stringify({
        marque_id: 140,
        marque_name: "Renault",
        modele_id: 140004,
        modele_name: "Clio III",
        type_id: 33300,
        type_name: "1.5 dCi",
      }),
    )}`;
    const result = await runAction(
      makeRequest({ vehicleReference: " ab-123-cd " }, cookie),
    );
    expect(result).toMatchObject({ ok: true });
    expect(posted[0].vehicleCheck).toEqual({
      customerReference: "ab-123-cd",
      purchaseVehicle: {
        typeId: 33300,
        brand: "Renault",
        model: "Clio III",
        engine: "1.5 dCi",
      },
    });
  });

  it("référence invalide : refusée avant tout POST de commande", async () => {
    const posted = stubFetch();
    await runAction(makeRequest({ vehicleReference: "<b>" }));
    expect(posted).toEqual([]);
  });
});

describe("textes de compatibilité", () => {
  it("le texte affiché est le texte vrai du mandat BN", () => {
    expect(COMPATIBILITY_NOTICE).toBe(
      "Nous vérifions la compatibilité avec votre véhicule avant l'envoi",
    );
  });

  it("l'étape paiement affiche le véhicule avec le texte vrai", () => {
    render(
      <MemoryRouter>
        <CheckoutPaiementSection
          paymentMethods={[]}
          selectedPaymentMethod=""
          onPaymentMethodChange={() => {}}
          acceptedTerms={false}
          onAcceptedTermsChange={() => {}}
          isProcessing={false}
          canSubmit={false}
          totalTTC={62.35}
          itemCount={1}
          vehicleLabel="Renault Clio III 1.5 dCi"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText((_, el) =>
        Boolean(
          el?.tagName === "SPAN" &&
          el.textContent ===
            `Renault Clio III 1.5 dCi — ${COMPATIBILITY_NOTICE}.`,
        ),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Compatibilite verifiee/i)).toBeNull();
  });

  it("aucune promesse de compatibilité vérifiée ne subsiste dans le tunnel", () => {
    const files = [
      "app/routes/checkout.tsx",
      "app/components/checkout/CheckoutPaiementSection.tsx",
      "app/components/checkout/CheckoutOrderSummary.tsx",
      "app/components/checkout/CheckoutLivraisonSection.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, "../..", f), "utf8");
      expect(src, f).not.toMatch(/Compatibilit[eé] v[eé]rifi[eé]e/i);
      expect(src, f).not.toMatch(
        /Pi[eè]ces compatibles avec votre v[eé]hicule/i,
      );
    }
  });
});
