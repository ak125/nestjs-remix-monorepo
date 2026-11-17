import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatShippingAmount } from "~/components/cart/cart-utils";
import { FreeShippingProgress } from "~/components/cart/FreeShippingProgress";
import { buildFaqFallback } from "~/components/home/constants";
import { type ShippingPolicyResult } from "~/utils/remix-application-port";

/**
 * Mandat BJ — le frontend ne porte aucun seuil ni forfait de port : il affiche
 * la règle servie par le backend (`useShippingPolicy()`), et n'affiche aucune
 * promesse de seuil quand cette règle n'a pas pu être lue.
 */
const policy = vi.hoisted(() => ({
  current: null as {
    flatFeeTTC: number;
    freeShippingThresholdTTC: number;
  } | null,
}));

vi.mock("~/hooks/useRootData", () => ({
  useShippingPolicy: () => policy.current,
}));

afterEach(() => {
  cleanup();
  policy.current = null;
});

const SERVED: ShippingPolicyResult = {
  flatFeeTTC: 9.9,
  freeShippingThresholdTTC: 100,
};

describe("formatShippingAmount", () => {
  it("écrit un montant entier sans décimales et un forfait à deux décimales", () => {
    expect(formatShippingAmount(100)).toBe("100€");
    expect(formatShippingAmount(9.9)).toBe("9,90€");
  });
});

describe("buildFaqFallback", () => {
  it("écrit le seuil servi dans la réponse sur la livraison", () => {
    const delivery = buildFaqFallback(SERVED, null).find((f) =>
      f.q.includes("délais de livraison"),
    );
    expect(delivery?.a).toContain("Livraison gratuite dès 100€ d'achat.");
  });

  it("n'écrit aucune promesse de seuil quand la règle est inconnue", () => {
    const text = buildFaqFallback(null, null)
      .map((f) => f.a)
      .join(" ");
    expect(text).not.toMatch(/gratuite/i);
  });
});

describe("FreeShippingProgress", () => {
  it("annonce le reste à ajouter jusqu'au seuil servi", () => {
    policy.current = SERVED;
    const { container } = render(<FreeShippingProgress subtotal={54.38} />);
    expect(container.textContent).toMatch(/45,62/);
  });

  it("annonce la livraison offerte au seuil exact", () => {
    policy.current = SERVED;
    const { container } = render(<FreeShippingProgress subtotal={100} />);
    expect(container.textContent).toContain("Livraison offerte débloquée");
  });

  it("ne rend rien quand la règle est inconnue", () => {
    policy.current = null;
    const { container } = render(<FreeShippingProgress subtotal={54.38} />);
    expect(container.firstChild).toBeNull();
  });
});
