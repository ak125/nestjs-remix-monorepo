import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TrustPage from "~/components/ecommerce/TrustPage";
import { FooterTrustRowV2 } from "~/components/expert/TrustRowV2";
import { buildFaqFallback } from "~/components/home/constants";
import { R1TrustStrip } from "~/components/pieces/R1TrustStrip";
import { FrictionReducer } from "~/components/trust/FrictionReducer";
import { TrustSection } from "~/components/vehicle/r8/sections/TrustSection";
import { type ReturnPolicyResult } from "~/utils/remix-application-port";
import {
  returnFaqAnswer,
  returnFeesWording,
  returnWindowLabel,
} from "~/utils/return-policy-wording";

/**
 * Mandat BJ, complément du 18/11/2026 — les textes publics sur les retours
 * lisent la politique servie par le backend (`useReturnPolicy()`) : délai de
 * 30 jours, frais à la charge du client sauf pièce défectueuse ou erreur de
 * notre part, remboursement par le moyen de paiement d'origine. Aucun ne dit
 * que le retour est gratuit ; sans politique lue, aucun délai n'est affiché.
 */
const policy = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock("~/hooks/useRootData", () => ({
  useReturnPolicy: () => policy.current,
}));

afterEach(() => {
  cleanup();
  policy.current = null;
});

const SERVED: ReturnPolicyResult = {
  country: "FR",
  returnWindowDays: 30,
  returnMethod: "by_mail",
  returnFeesPaidBy: "customer",
  returnFeesWaivedFor: ["item_defect", "seller_error"],
  refundMethod: "original_payment_method",
};

const RETOUR_GRATUIT = /retours?\s+gratuits?|retours?[^.]{0,40}gratuit/i;

describe("formulations de la politique de retour", () => {
  it("écrivent le délai et les frais servis", () => {
    expect(returnWindowLabel(SERVED)).toBe("Retours 30 jours");
    expect(returnWindowLabel({ ...SERVED, returnWindowDays: 45 })).toBe(
      "Retours 45 jours",
    );
    expect(returnFeesWording(SERVED)).toBe(
      "Frais de retour à votre charge, sauf pièce défectueuse ou erreur de notre part",
    );
  });

  it("la réponse de FAQ est celle du backend (FaqService), mot pour mot", () => {
    // Même texte que `returnFaqAnswer()` de
    // backend/src/modules/cart/config/return-policy.config.ts (testé côté backend).
    expect(returnFaqAnswer(SERVED)).toBe(
      "Vous disposez de 30 jours après réception pour retourner une pièce, " +
        "dans son emballage d'origine et non montée. " +
        "Frais de retour à votre charge, sauf pièce défectueuse ou erreur de notre part. " +
        "Le remboursement est effectué par le moyen de paiement utilisé lors de la commande.",
    );
  });
});

describe("FAQ de repli", () => {
  it("répond sur les retours depuis la politique servie", () => {
    const faq = buildFaqFallback(null, SERVED).find((f) =>
      f.q.includes("retourner"),
    );
    expect(faq?.a).toBe(returnFaqAnswer(SERVED));
    expect(faq?.a).not.toMatch(/gratuit/i);
  });

  it("omet la question sur les retours quand la politique est inconnue", () => {
    const faq = buildFaqFallback(null, null);
    expect(faq.some((f) => f.q.includes("retourner"))).toBe(false);
    expect(faq.every((f) => f.a.length > 0)).toBe(true);
  });
});

describe("composants de réassurance", () => {
  const cases: Array<[string, () => ReactElement]> = [
    ["TrustPage", () => <TrustPage showSections={{ security: true }} />],
    ["FooterTrustRowV2", () => <FooterTrustRowV2 />],
    ["FrictionReducer", () => <FrictionReducer type="return" />],
    ["R1TrustStrip", () => <R1TrustStrip />],
    ["TrustSection", () => <TrustSection />],
  ];

  it.each(cases)("%s : délai servi, retour jamais gratuit", (_name, ui) => {
    policy.current = SERVED;
    const { container } = render(ui());
    expect(container.textContent).toContain("Retours 30 jours");
    expect(container.textContent).not.toMatch(RETOUR_GRATUIT);
  });

  it.each(cases)("%s : suit la politique servie", (_name, ui) => {
    policy.current = { ...SERVED, returnWindowDays: 45 };
    const { container } = render(ui());
    expect(container.textContent).toContain("Retours 45 jours");
  });

  it.each(cases)("%s : aucun délai sans politique", (_name, ui) => {
    policy.current = null;
    const { container } = render(ui());
    expect(container.textContent).not.toMatch(/Retours?\s+\d+\s*(jours|j)\b/i);
    expect(container.textContent).not.toMatch(/30 jours/);
  });
});

describe("plus aucun délai de retour écrit en dur", () => {
  // Les quatorze emplacements relevés dans la PR #2143 (page Confiance et
  // treize mentions « 30 jours ») : ils lisent la politique servie.
  const FILES = [
    "app/components/ecommerce/TrustPage.tsx",
    "app/components/vehicle/r8/sections/TrustSection.tsx",
    "app/components/expert/TrustRowV2.tsx",
    "app/components/trust/FrictionReducer.tsx",
    "app/components/cart/CartSummaryBlock.tsx",
    "app/components/checkout/CheckoutOrderSummary.tsx",
    "app/routes/constructeurs.$brand.$model.$type.tsx",
    "app/components/home/constants.ts",
    "app/components/home/WhyAutomecanikSection.tsx",
    "app/routes/pieces.$slug.tsx",
    "app/components/pieces/R1TrustStrip.tsx",
    "app/components/pieces/hero/site-trust-claims.ts",
    "app/routes/checkout.tsx",
    "app/routes/_public+/register.tsx",
  ];

  it.each(FILES)("%s", (file) => {
    const source = readFileSync(resolve(__dirname, "../..", file), "utf-8");
    expect(source).not.toMatch(/Retours?( sous)? \d+ ?(jours|j)\b/);
    expect(source).not.toMatch(/retours?\s+gratuits?/i);
  });
});
