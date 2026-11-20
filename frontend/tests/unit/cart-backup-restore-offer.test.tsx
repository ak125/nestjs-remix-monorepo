/** Page panier : la sauvegarde locale (`automecanik_cart_backup`) sert à proposer
 * la restauration quand le panier du serveur revient vide (session perdue) ou
 * ne se charge pas. Elle ne doit donc pas être effacée à l'arrivée sur un panier
 * vide ; elle n'est effacée que lorsque le client vide son panier sur la page.
 * Valeurs fictives uniquement. */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "~/routes/cart";

vi.mock("~/utils/analytics", () => ({ trackViewCart: vi.fn() }));
vi.mock("~/services/cart.server", () => ({
  clearCart: vi.fn(),
  getCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateQuantity: vi.fn(),
}));

const BACKUP_KEY = "automecanik_cart_backup";

const EMPTY_SUMMARY = {
  total_items: 0,
  total_price: 0,
  subtotal: 0,
  tax_amount: 0,
  shipping_cost: 0,
  consigne_total: 0,
  currency: "EUR",
};

const ITEM = {
  id: "LIGNE-FICTIVE-1",
  product_id: "1001",
  quantity: 2,
  price: 10,
  product_name: "Pièce fictive",
  unit_price: 10,
  total_price: 20,
};

type LoaderData = {
  cart: { items: unknown[]; summary: typeof EMPTY_SUMMARY };
  vehicle: null;
  crossSellGammes: never[];
  success: boolean;
  error: string | null;
};

function emptyCart(overrides: Partial<LoaderData> = {}): LoaderData {
  return {
    cart: { items: [], summary: EMPTY_SUMMARY },
    vehicle: null,
    crossSellGammes: [],
    success: true,
    error: null,
    ...overrides,
  };
}

function filledCart(): LoaderData {
  return emptyCart({
    cart: {
      items: [ITEM],
      summary: {
        ...EMPTY_SUMMARY,
        total_items: 2,
        total_price: 20,
        subtotal: 20,
      },
    },
  });
}

function seedBackup() {
  localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({
      items: [
        { product_id: 1001, quantity: 2 },
        { product_id: 1002, quantity: 1 },
      ],
      savedAt: Date.now(),
    }),
  );
}

function renderCart(state: { data: LoaderData }) {
  const Stub = createRoutesStub([
    {
      path: "/cart",
      Component: CartPage,
      HydrateFallback: () => null,
      loader: () => state.data,
      // Le vidage passe par l'action de la route ; le loader est relu ensuite.
      action: () => {
        state.data = emptyCart();
        return { success: true };
      },
    },
  ]);
  return render(<Stub initialEntries={["/cart"]} />);
}

describe("cart — sauvegarde locale et offre de restauration", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("panier vide à l'arrivée : la sauvegarde est proposée, pas effacée", async () => {
    seedBackup();
    renderCart({ data: emptyCart() });
    expect(
      await screen.findByText(/Votre panier precedent contenait 2 articles/),
    ).toBeTruthy();
    expect(localStorage.getItem(BACKUP_KEY)).not.toBeNull();
  });

  it("panier en erreur de chargement : la sauvegarde est proposée, pas effacée", async () => {
    seedBackup();
    renderCart({
      data: emptyCart({ success: false, error: "Erreur fictive" }),
    });
    expect(await screen.findByText(/sauvegarde locale/)).toBeTruthy();
    expect(localStorage.getItem(BACKUP_KEY)).not.toBeNull();
  });

  it("« Non merci » : la sauvegarde est effacée et l'offre disparaît", async () => {
    seedBackup();
    renderCart({ data: emptyCart() });
    fireEvent.click(await screen.findByRole("button", { name: "Non merci" }));
    await waitFor(() =>
      expect(screen.queryByText(/Votre panier precedent/)).toBeNull(),
    );
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("panier garni : la sauvegarde est écrite", async () => {
    renderCart({ data: filledCart() });
    await screen.findByText("Mon panier");
    await waitFor(() =>
      expect(localStorage.getItem(BACKUP_KEY)).not.toBeNull(),
    );
    const saved = JSON.parse(localStorage.getItem(BACKUP_KEY) as string);
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0].product_id).toBe("1001");
  });

  it("panier vidé sur la page : la sauvegarde est effacée, aucune offre", async () => {
    renderCart({ data: filledCart() });
    fireEvent.click(await screen.findByText("Vider le panier"));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(screen.queryByText("Mon panier")).toBeNull());
    await waitFor(() => expect(localStorage.getItem(BACKUP_KEY)).toBeNull());
    expect(screen.queryByText(/Votre panier precedent/)).toBeNull();
  });
});
