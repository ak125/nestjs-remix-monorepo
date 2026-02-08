/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📘 SMART HEADER - EXEMPLE D'UTILISATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Démonstration du SmartHeader e-commerce avec :
 * • Gestion véhicule mémorisé (localStorage)
 * • Recherche fonctionnelle
 * • Panier dynamique
 * • Cas d'usage réels
 */

import { useState, useEffect } from "react";
import { SmartHeader } from "./SmartHeader";
import { logger } from "~/utils/logger";

// Types
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  engine?: string;
  year: number;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE AVEC VÉHICULE MÉMORISÉ
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SmartHeaderWithVehicle() {
  const [savedVehicle, setSavedVehicle] = useState<Vehicle | null>(null);
  const [cartCount] = useState(3);

  // Charger véhicule depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem("userVehicle");
    if (stored) {
      setSavedVehicle(JSON.parse(stored));
    }
  }, []);

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSavedVehicle(vehicle);
    localStorage.setItem("userVehicle", JSON.stringify(vehicle));
    logger.log("✅ Véhicule sauvegardé:", vehicle);
  };

  const handleSearch = (query: string) => {
    logger.log("🔍 Recherche:", query);
    // Redirection vers page résultats
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  };

  return (
    <SmartHeader
      savedVehicle={savedVehicle}
      onVehicleSelect={handleVehicleSelect}
      onSearch={handleSearch}
      cartItemCount={cartCount}
      logoUrl="/logo.svg"
      companyName="AutoPieces Pro"
    />
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE SANS VÉHICULE (Premier Visiteur)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SmartHeaderNewVisitor() {
  return (
    <div>
      {/* Header sans véhicule = CTA "Mon véhicule" affiché */}
      <SmartHeader
        savedVehicle={null}
        onVehicleSelect={(vehicle) =>
          logger.log("Véhicule sélectionné:", vehicle)
        }
        onSearch={(query) => logger.log("Recherche:", query)}
        cartItemCount={0}
        logoUrl="/logo.svg"
        companyName="AutoPieces Pro"
      />

      {/* Contenu page avec espacement */}
      <main className="py-xl px-md max-w-7xl mx-auto">
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-md mb-lg">
          <p className="font-sans text-warning-800">
            <strong className="font-heading">
              ⚠️ Nouveau visiteur détecté
            </strong>
            <br />
            Le CTA "Mon véhicule" est affiché pour inciter à la configuration.
          </p>
        </div>

        <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-md">
          Bienvenue sur AutoPieces Pro
        </h1>
        <p className="font-sans text-neutral-600">
          Configurez votre véhicule pour voir les pièces compatibles.
        </p>
      </main>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE AVEC VÉHICULE CONFIGURÉ
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SmartHeaderConfiguredVehicle() {
  const mockVehicle: Vehicle = {
    id: "renault-clio4-15dci-2016",
    brand: "Renault",
    model: "Clio 4",
    engine: "1.5 dCi",
    year: 2016,
  };

  return (
    <div>
      {/* Header avec véhicule = affiche "Renault Clio 4" dans le CTA */}
      <SmartHeader
        savedVehicle={mockVehicle}
        onVehicleSelect={(vehicle) =>
          logger.log("Changement véhicule:", vehicle)
        }
        onSearch={(query) => logger.log("Recherche:", query)}
        cartItemCount={5}
        logoUrl="/logo.svg"
        companyName="AutoPieces Pro"
      />

      {/* Contenu page */}
      <main className="py-xl px-md max-w-7xl mx-auto">
        <div className="bg-success-50 border border-success-200 rounded-lg p-md mb-lg">
          <p className="font-sans text-success-800">
            <strong className="font-heading">✅ Véhicule configuré</strong>
            <br />
            Le header affiche "Renault Clio 4 • 1.5 dCi • 2016" dans le CTA.
          </p>
        </div>

        <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-md">
          Pièces pour votre {mockVehicle.brand} {mockVehicle.model}
        </h1>

        {/* Exemple produits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {[
            {
              name: "Plaquettes de frein avant",
              oemRef: "REF-7701208265",
              price: 45.9,
              compatible: true,
            },
            {
              name: "Filtre à huile",
              oemRef: "REF-8200768913",
              price: 12.5,
              compatible: true,
            },
            {
              name: "Disques de frein (x2)",
              oemRef: "REF-7701207795",
              price: 89.0,
              compatible: true,
            },
          ].map((product) => (
            <article
              key={product.oemRef}
              className="bg-white rounded-lg shadow-md border border-neutral-200 p-md"
            >
              {/* Badge compatible (Success) */}
              <div className="flex items-center gap-xs mb-sm">
                <span className="bg-success-500 text-white px-sm py-xs rounded font-sans text-xs font-semibold">
                  ✓ Compatible
                </span>
              </div>

              {/* Nom produit (Montserrat) */}
              <h3 className="font-heading text-lg font-bold text-neutral-900 mb-xs">
                {product.name}
              </h3>

              {/* Référence OEM (Roboto Mono) */}
              <code className="font-mono text-xs text-neutral-600 bg-neutral-100 px-xs py-xs rounded">
                {product.oemRef}
              </code>

              {/* Prix (Roboto Mono) */}
              <div className="font-mono text-2xl font-bold text-neutral-900 mt-md mb-md">
                {product.price.toFixed(2)} €
              </div>

              {/* Bouton CTA (Primary) */}
              <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-sm px-md rounded-lg font-heading font-semibold transition-colors">
                Ajouter au panier
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE COMPLET POUR SHOWCASE
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SmartHeaderShowcase() {
  const [scenario, setScenario] = useState<"new" | "configured">("new");

  const mockVehicle: Vehicle = {
    id: "renault-megane4-16dci-2018",
    brand: "Renault",
    model: "Mégane 4",
    engine: "1.6 dCi",
    year: 2018,
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Switcher de scénario */}
      <div className="fixed bottom-md right-md z-50 bg-white rounded-lg shadow-xl p-md border border-neutral-200">
        <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
          🎬 Scénarios de démonstration
        </h3>
        <div className="flex flex-col gap-xs">
          <button
            onClick={() => setScenario("new")}
            className={`
              px-sm py-xs rounded font-sans text-sm text-left
              ${
                scenario === "new"
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }
              transition-colors
            `}
          >
            👤 Nouveau visiteur
          </button>
          <button
            onClick={() => setScenario("configured")}
            className={`
              px-sm py-xs rounded font-sans text-sm text-left
              ${
                scenario === "configured"
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }
              transition-colors
            `}
          >
            ✅ Véhicule configuré
          </button>
        </div>
      </div>

      {/* Header adaptatif */}
      <SmartHeader
        savedVehicle={scenario === "configured" ? mockVehicle : null}
        onVehicleSelect={(vehicle) => logger.log("Véhicule:", vehicle)}
        onSearch={(query) => logger.log("Recherche:", query)}
        cartItemCount={scenario === "configured" ? 3 : 0}
        logoUrl="/logo.svg"
        companyName="AutoPieces Pro"
      />

      {/* Contenu de démonstration */}
      <main className="py-xl px-md max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-xl mb-xl">
          <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-md">
            Smart Header E-Commerce
          </h1>
          <p className="font-sans text-lg text-neutral-600 mb-lg">
            Header intelligent optimisé pour site e-commerce pièces automobile.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-secondary-900 mb-sm">
                🔍 Recherche Intelligente
              </h3>
              <p className="font-sans text-sm text-secondary-700">
                Recherche par marque, modèle, moteur, année, référence OEM.
                Suggestions rapides intégrées.
              </p>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-primary-900 mb-sm">
                🚗 CTA "Mon Véhicule"
              </h3>
              <p className="font-sans text-sm text-primary-700">
                Mémorise le véhicule utilisateur. Affiche les infos dans le
                header. Toujours visible (sticky).
              </p>
            </div>

            <div className="bg-success-50 border border-success-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-success-900 mb-sm">
                📱 Responsive & Sticky
              </h3>
              <p className="font-sans text-sm text-success-700">
                Adaptatif mobile → desktop. Sticky au scroll. Navigation
                secondaire contextuelle.
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-neutral-100 rounded-lg p-lg">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-md">
            💡 Testez le header
          </h2>
          <ul className="font-sans text-neutral-700 space-y-sm">
            <li>
              • Utilisez le switcher en bas à droite pour changer de scénario
            </li>
            <li>• Scrollez pour voir l'effet sticky</li>
            <li>• Cliquez sur "Mon véhicule" pour ouvrir le modal</li>
            <li>• Testez la recherche avec suggestions rapides</li>
            <li>• Réduisez la fenêtre pour voir le responsive mobile</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default SmartHeaderShowcase;
