import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRestoreAddItemBody,
  clearCartLocalStorage,
  loadCartFromLocalStorage,
  saveCartToLocalStorage,
} from "~/components/cart/cart-utils";

// La restauration du panier depuis localStorage rejoue POST /api/cart/items.
// Elle doit transmettre le contexte d'ajout que la sauvegarde a conservé,
// sinon la ligne restaurée perd sa page d'ajout (orl_website_url) et son
// véhicule (type_id).
describe("buildRestoreAddItemBody — restauration du panier sauvegardé", () => {
  it("rejoue la page d'ajout et le véhicule de la ligne sauvegardée", () => {
    expect(
      buildRestoreAddItemBody({
        product_id: 5660748,
        quantity: 2,
        product_name: "Disque de frein",
        price: 29.36,
        type_id: 18376,
        website_url: "/pieces/disque-de-frein-82/renault-clio-iii.html",
      }),
    ).toEqual({
      product_id: 5660748,
      quantity: 2,
      type_id: 18376,
      website_url: "/pieces/disque-de-frein-82/renault-clio-iii.html",
    });
  });

  it("n'envoie jamais le prix sauvegardé : le serveur fait autorité", () => {
    const body = buildRestoreAddItemBody({
      product_id: 1,
      quantity: 1,
      price: 0.01,
    });
    expect(body).not.toHaveProperty("price");
  });

  it("reste compatible avec une sauvegarde sans contexte d'ajout", () => {
    expect(buildRestoreAddItemBody({ product_id: 1, quantity: 3 })).toEqual({
      product_id: 1,
      quantity: 3,
    });
  });
});

// La sauvegarde garde la ligne entière : le contexte d'ajout doit survivre à
// l'aller-retour localStorage pour pouvoir être rejoué.
describe("sauvegarde localStorage du panier", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("conserve la page d'ajout et le véhicule à l'aller-retour", () => {
    const ligne = {
      product_id: 5660748,
      quantity: 1,
      type_id: 18376,
      website_url: "/pieces/disque-de-frein-82/renault-clio-iii.html",
    };
    saveCartToLocalStorage([ligne]);

    const [relue] = loadCartFromLocalStorage() ?? [];
    expect(buildRestoreAddItemBody(relue)).toEqual(ligne);
  });

  it("efface la sauvegarde quand le panier est vide", () => {
    saveCartToLocalStorage([{ product_id: 1, quantity: 1 }]);
    saveCartToLocalStorage([]);
    expect(loadCartFromLocalStorage()).toBeNull();
  });

  it("écarte une sauvegarde de plus de 7 jours", () => {
    window.localStorage.setItem(
      "automecanik_cart_backup",
      JSON.stringify({
        items: [{ product_id: 1, quantity: 1 }],
        savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      }),
    );
    expect(loadCartFromLocalStorage()).toBeNull();
    expect(window.localStorage.getItem("automecanik_cart_backup")).toBeNull();
  });

  it("ignore une sauvegarde illisible", () => {
    window.localStorage.setItem("automecanik_cart_backup", "{ pas du json");
    expect(loadCartFromLocalStorage()).toBeNull();
  });

  it("ne lève pas quand le stockage est bloqué (SecurityError)", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() =>
      saveCartToLocalStorage([{ product_id: 1, quantity: 1 }]),
    ).not.toThrow();
    expect(loadCartFromLocalStorage()).toBeNull();
    expect(() => clearCartLocalStorage()).not.toThrow();
  });
});
