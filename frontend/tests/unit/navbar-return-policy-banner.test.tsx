import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "~/components/Navbar";
import { type ReturnPolicyResult } from "~/utils/remix-application-port";

/**
 * Mandat BJ (décision du 17/11/2026 22:13) — le bandeau « Retours 30j » lit la
 * politique de retour servie par le backend (`useReturnPolicy()`), la même que
 * le JSON-LD. Sans règle lue, aucun délai n'est affiché.
 */
const returns = vi.hoisted(() => ({
  current: null as ReturnPolicyResult | null,
}));

vi.mock("~/hooks/useRootData", () => ({
  useOptionalUser: () => null,
  useRootCart: () => null,
  useShippingPolicy: () => null,
  useReturnPolicy: () => returns.current,
}));
vi.mock("~/components/navbar/CartSidebarSimple", () => ({
  CartSidebarSimple: () => null,
}));
vi.mock("~/components/navbar/UserDropdownMenu", () => ({
  UserDropdownMenu: () => null,
}));

const servie = (returnWindowDays: number): ReturnPolicyResult => ({
  country: "FR",
  returnWindowDays,
  returnMethod: "by_mail",
  returnFeesPaidBy: "customer",
  returnFeesWaivedFor: ["item_defect", "seller_error"],
  refundMethod: "original_payment_method",
});

const bandeau = () =>
  renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <Navbar />
    </MemoryRouter>,
  );

describe("Navbar — bandeau des retours", () => {
  it("affiche le délai servi : « Retours 30j »", () => {
    returns.current = servie(30);
    expect(bandeau()).toMatch(/Retours (<!-- -->)?30(<!-- -->)?j/);
  });

  it("suit la règle reçue, pas une valeur du frontend", () => {
    returns.current = servie(45);
    const html = bandeau();
    expect(html).toMatch(/Retours (<!-- -->)?45(<!-- -->)?j/);
    expect(html).not.toMatch(/Retours (<!-- -->)?30/);
  });

  it("règle indisponible : aucun délai de retour affiché", () => {
    returns.current = null;
    expect(bandeau()).not.toMatch(/Retours/);
  });
});
