/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 QUICK CART DRAWER - EXEMPLES D'UTILISATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { logger } from "~/utils/logger";
import { QuickCartDrawer, type CartItem } from "./QuickCartDrawer";

// Mock data
const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: "1",
    productId: "prod-1",
    name: "Plaquettes de frein avant",
    oemRef: "7701208265",
    imageUrl: "/images/plaquettes-frein.jpg",
    price: 45.9,
    quantity: 2,
    isCompatible: true,
    stockStatus: "in-stock",
  },
  {
    id: "2",
    productId: "prod-2",
    name: "Disques de frein (x2)",
    oemRef: "7701207795",
    imageUrl: "/images/disques-frein.jpg",
    price: 89.0,
    quantity: 1,
    isCompatible: true,
    stockStatus: "low-stock",
  },
  {
    id: "3",
    productId: "prod-3",
    name: "Filtre à huile",
    oemRef: "8200768913",
    imageUrl: "/images/filtre-huile.jpg",
    price: 12.5,
    quantity: 1,
    isCompatible: false,
    stockStatus: "out-of-stock",
  },
];

const MOCK_VEHICLE = {
  brand: "Peugeot",
  model: "208",
  year: 2016,
  engine: "1.6 HDi",
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 1: Utilisation Basique
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function QuickCartDrawerBasic() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>(MOCK_CART_ITEMS);
  const [selectedDelivery, setSelectedDelivery] = useState("standard");

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleCheckout = () => {
    logger.log("Checkout:", { items, selectedDelivery });
    alert("Redirection vers paiement...");
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-xl">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-lg">
          Quick Cart Drawer - Basique
        </h1>

        <button
          onClick={() => setIsOpen(true)}
          className="px-xl py-md bg-primary-500 text-white rounded-lg font-heading font-semibold hover:bg-primary-600 transition-colors"
        >
          Ouvrir le panier ({items.reduce((sum, i) => sum + i.quantity, 0)})
        </button>

        <QuickCartDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          items={items}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          selectedDeliveryId={selectedDelivery}
          onSelectDelivery={setSelectedDelivery}
          savedVehicle={MOCK_VEHICLE}
        />
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 2: Avec Ajout Instantané
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function QuickCartDrawerWithInstantAdd() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState("standard");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAddToCart = (product: Omit<CartItem, "id" | "quantity">) => {
    const existingItem = items.find(
      (item) => item.productId === product.productId,
    );

    if (existingItem) {
      // Incrémenter quantité
      setItems((prev) =>
        prev.map((item) =>
          item.productId === product.productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      // Ajouter nouveau
      const newItem: CartItem = {
        ...product,
        id: `cart-${Date.now()}`,
        quantity: 1,
      };
      setItems((prev) => [...prev, newItem]);
    }

    // Animation feedback
    setJustAdded(product.productId);
    setTimeout(() => setJustAdded(null), 2000);

    // Ouvrir drawer automatiquement
    setIsOpen(true);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleCheckout = () => {
    logger.log("Checkout:", items);
  };

  // Produits disponibles
  const products = [
    {
      productId: "prod-1",
      name: "Plaquettes de frein avant",
      oemRef: "7701208265",
      imageUrl: "/images/plaquettes-frein.jpg",
      price: 45.9,
      isCompatible: true,
      stockStatus: "in-stock" as const,
    },
    {
      productId: "prod-2",
      name: "Disques de frein (x2)",
      oemRef: "7701207795",
      imageUrl: "/images/disques-frein.jpg",
      price: 89.0,
      isCompatible: true,
      stockStatus: "low-stock" as const,
    },
    {
      productId: "prod-3",
      name: "Filtre à huile",
      oemRef: "8200768913",
      imageUrl: "/images/filtre-huile.jpg",
      price: 12.5,
      isCompatible: false,
      stockStatus: "in-stock" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-xl">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-lg">
          Ajout Instantané au Panier
        </h1>

        {/* Grille produits */}
        <div className="grid grid-cols-3 gap-lg mb-xl">
          {products.map((product) => (
            <div
              key={product.productId}
              className="bg-white rounded-lg p-md shadow-md"
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-32 object-cover rounded-lg mb-sm"
              />
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-xs">
                {product.name}
              </h3>
              <p className="font-mono text-lg font-bold text-neutral-900 mb-sm">
                {product.price.toFixed(2)} €
              </p>
              <button
                onClick={() => handleAddToCart(product)}
                className={`
                  w-full py-sm rounded-lg font-heading font-semibold transition-all
                  ${
                    justAdded === product.productId
                      ? "bg-success-500 text-white"
                      : "bg-primary-500 text-white hover:bg-primary-600"
                  }
                `}
              >
                {justAdded === product.productId ? "✓ Ajouté" : "Ajouter"}
              </button>
            </div>
          ))}
        </div>

        {/* Bouton panier flottant */}
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 px-xl py-md bg-primary-500 text-white rounded-full font-heading font-bold shadow-2xl hover:bg-primary-600 transition-all hover:scale-110"
        >
          🛒 Panier ({items.reduce((sum, i) => sum + i.quantity, 0)})
        </button>

        <QuickCartDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          items={items}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          selectedDeliveryId={selectedDelivery}
          onSelectDelivery={setSelectedDelivery}
          savedVehicle={MOCK_VEHICLE}
        />
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 3: Showcase Complet
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function QuickCartDrawerShowcase() {
  const [scenario, setScenario] = useState<"empty" | "compatible" | "mixed">(
    "compatible",
  );
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState("standard");

  const scenarios = {
    empty: [],
    compatible: [
      {
        id: "1",
        productId: "prod-1",
        name: "Plaquettes de frein avant",
        oemRef: "7701208265",
        imageUrl: "/images/plaquettes-frein.jpg",
        price: 45.9,
        quantity: 2,
        isCompatible: true,
        stockStatus: "in-stock" as const,
      },
      {
        id: "2",
        productId: "prod-2",
        name: "Disques de frein (x2)",
        oemRef: "7701207795",
        imageUrl: "/images/disques-frein.jpg",
        price: 89.0,
        quantity: 1,
        isCompatible: true,
        stockStatus: "low-stock" as const,
      },
    ],
    mixed: MOCK_CART_ITEMS,
  };

  const [items, setItems] = useState<CartItem[]>(scenarios[scenario]);

  const handleScenarioChange = (newScenario: typeof scenario) => {
    setScenario(newScenario);
    setItems(scenarios[newScenario]);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleCheckout = () => {
    logger.log("Checkout");
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-xl px-md">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-xl text-center">
          🛒 Quick Cart Drawer - Showcase
        </h1>

        {/* Switcher scénarios */}
        <div className="bg-white rounded-lg shadow-md p-md mb-xl">
          <h2 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
            🎬 Scénarios de démonstration
          </h2>
          <div className="flex flex-wrap gap-sm">
            <button
              onClick={() => handleScenarioChange("empty")}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === "empty" ? "bg-primary-500 text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}
              `}
            >
              Panier Vide
            </button>
            <button
              onClick={() => handleScenarioChange("compatible")}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === "compatible" ? "bg-primary-500 text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}
              `}
            >
              Produits Compatibles (2)
            </button>
            <button
              onClick={() => handleScenarioChange("mixed")}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === "mixed" ? "bg-primary-500 text-white" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}
              `}
            >
              Mix Compatible/Incompatible (3)
            </button>
          </div>
        </div>

        {/* Bouton ouvrir */}
        <div className="text-center">
          <button
            onClick={() => setIsOpen(true)}
            className="px-2xl py-lg bg-primary-500 text-white rounded-lg font-heading text-xl font-bold hover:bg-primary-600 transition-colors shadow-lg hover:shadow-xl"
          >
            Ouvrir le Panier ({items.reduce((sum, i) => sum + i.quantity, 0)})
          </button>
        </div>

        {/* Documentation */}
        <div className="mt-xl bg-white rounded-lg shadow-md p-xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            📚 Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-primary-900 mb-sm">
                🚀 Ajout Instantané
              </h3>
              <ul className="font-sans text-sm text-primary-700 space-y-xs">
                <li>• Sans rechargement page</li>
                <li>• Feedback visuel immédiat</li>
                <li>• Animation slide depuis droite</li>
                <li>• Auto-ouverture après ajout</li>
              </ul>
            </div>

            <div className="bg-success-50 border border-success-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-success-900 mb-sm">
                💰 Résumé Complet
              </h3>
              <ul className="font-sans text-sm text-success-700 space-y-xs">
                <li>• Sous-total temps réel</li>
                <li>• Options livraison (3)</li>
                <li>• Total avec livraison</li>
                <li>• Compteur articles</li>
              </ul>
            </div>

            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-secondary-900 mb-sm">
                ✓ Compatibilité
              </h3>
              <ul className="font-sans text-sm text-secondary-700 space-y-xs">
                <li>• Badge compatible/incompatible</li>
                <li>• Alerte incompatibilités</li>
                <li>• Info véhicule configuré</li>
                <li>• Validation avant checkout</li>
              </ul>
            </div>
          </div>
        </div>

        <QuickCartDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          items={items}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          selectedDeliveryId={selectedDelivery}
          onSelectDelivery={setSelectedDelivery}
          savedVehicle={MOCK_VEHICLE}
        />
      </div>
    </div>
  );
}

export default QuickCartDrawerShowcase;
