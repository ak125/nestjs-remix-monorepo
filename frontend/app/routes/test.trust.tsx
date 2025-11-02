/**
 * 🎯 TEST CONFIANCE & PERSUASION
 * 
 * Démo de tous les composants de trust/persuasion:
 * - TrustBadge (OEM, Garantie, Stock)
 * - SocialProof (Compteurs vendus, avis, rating)
 * - FrictionReducer (Retour 30j, Paiement sécurisé)
 * - PricingDisplay (Prix barré crédible)
 */

import { Button } from "@fafa/ui";
import { useState } from "react";
import { FrictionReducer, FrictionReducerGroup } from "~/components/trust/FrictionReducer";
import { PricingDisplay, PriceComparison } from "~/components/trust/PricingDisplay";
import { SocialProof, StarRating } from "~/components/trust/SocialProof";
import { TrustBadge, TrustBadgeGroup } from "~/components/trust/TrustBadge";

export default function TestTrustPage() {
  const [activeTab, setActiveTab] = useState<"badges" | "social" | "friction" | "pricing">("badges");

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 Confiance & Persuasion
          </h1>
          <p className="text-lg text-gray-600">
            Badges, compteurs sociaux, réducteurs de friction, prix barré crédible
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {(["badges", "social", "friction", "pricing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab === "badges" && "🏆 Badges"}
              {tab === "social" && "📊 Social Proof"}
              {tab === "friction" && "🛡️ Assurances"}
              {tab === "pricing" && "💰 Prix"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {activeTab === "badges" && <BadgesDemo />}
          {activeTab === "social" && <SocialProofDemo />}
          {activeTab === "friction" && <FrictionDemo />}
          {activeTab === "pricing" && <PricingDemo />}
        </div>

        {/* Use Case Complet */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">💡 Exemple Complet: Fiche Produit</h2>
          <ProductCardExample />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 DÉMO BADGES
// ═══════════════════════════════════════════════════════════════════════════

function BadgesDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Badges de Confiance</h2>
        <p className="text-gray-600 mb-6">
          Rassurer l'acheteur avec des badges visuels forts
        </p>
      </div>

      {/* Variant Default */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Default (avec description)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <TrustBadge type="oem" />
          <TrustBadge type="warranty" />
          <TrustBadge type="stock" />
          <TrustBadge type="fast-delivery" />
        </div>
      </div>

      {/* Variant Compact */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Compact</h3>
        <TrustBadgeGroup badges={["oem", "warranty", "stock", "fast-delivery"]} variant="compact" />
      </div>

      {/* Variant Icon Only */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Icon Only</h3>
        <div className="flex gap-3">
          <TrustBadge type="oem" variant="icon-only" />
          <TrustBadge type="warranty" variant="icon-only" />
          <TrustBadge type="certified" variant="icon-only" />
          <TrustBadge type="eco" variant="icon-only" />
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 Best Practices:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Max 3-4 badges par produit (éviter surcharge)</li>
          <li>• Utiliser badges pertinents (OEM pour pièces origine)</li>
          <li>• Compact pour cards, Default pour pages détail</li>
          <li>• Stock temps réel = fort argument conversion</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 DÉMO SOCIAL PROOF
// ═══════════════════════════════════════════════════════════════════════════

function SocialProofDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Preuve Sociale</h2>
        <p className="text-gray-600 mb-6">
          Compteurs et ratings pour rassurer via la validation sociale
        </p>
      </div>

      {/* Full Variant */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Full</h3>
        <SocialProof
          soldCount={1247}
          reviewCount={389}
          rating={4.7}
          recommendationRate={96}
          variant="full"
        />
      </div>

      {/* Compact Variant */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Compact</h3>
        <SocialProof
          soldCount={1247}
          reviewCount={389}
          rating={4.7}
          variant="compact"
        />
      </div>

      {/* Inline Variant */}
      <div>
        <h3 className="font-semibold mb-3">Variant: Inline</h3>
        <SocialProof
          soldCount={523}
          reviewCount={127}
          rating={4.9}
          variant="inline"
        />
      </div>

      {/* Star Rating Only */}
      <div>
        <h3 className="font-semibold mb-3">Star Rating Seul</h3>
        <div className="flex gap-4 items-center">
          <StarRating rating={5} size="lg" />
          <StarRating rating={4.5} size="md" />
          <StarRating rating={3.7} size="sm" />
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 Best Practices:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Afficher compteurs dès 50+ ventes (crédibilité)</li>
          <li>• Rating min 4.0 recommandé pour affichage</li>
          <li>• Format compact pour cards, Full pour détail</li>
          <li>• Mise à jour temps réel = trustworthy</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ DÉMO FRICTION REDUCERS
// ═══════════════════════════════════════════════════════════════════════════

function FrictionDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Réducteurs de Friction</h2>
        <p className="text-gray-600 mb-6">
          Assurances pour lever les objections et faciliter l'achat
        </p>
      </div>

      {/* Individual */}
      <div>
        <h3 className="font-semibold mb-3">Assurances Individuelles</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <FrictionReducer type="return" />
          <FrictionReducer type="secure-payment" />
          <FrictionReducer type="satisfaction" />
          <FrictionReducer type="support" />
        </div>
      </div>

      {/* Group Compact */}
      <div>
        <h3 className="font-semibold mb-3">Groupe Compact</h3>
        <FrictionReducerGroup
          assurances={["return", "secure-payment", "satisfaction", "support"]}
          variant="compact"
        />
      </div>

      {/* Best Practices */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 Best Practices:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Afficher près du CTA (Add to Cart, Acheter)</li>
          <li>• Retour 30j = fort argument conversion (+18%)</li>
          <li>• Paiement sécurisé obligatoire (anxiété acheteur)</li>
          <li>• Support réactif rassure sur SAV</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 💰 DÉMO PRICING
// ═══════════════════════════════════════════════════════════════════════════

function PricingDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Prix Barré Crédible</h2>
        <p className="text-gray-600 mb-6">
          Règles strictes pour prix barré acceptable légalement
        </p>
      </div>

      {/* Sizes */}
      <div className="space-y-4">
        <h3 className="font-semibold">Tailles Disponibles</h3>
        <PricingDisplay price={89.99} originalPrice={119.99} size="lg" />
        <PricingDisplay price={89.99} originalPrice={119.99} size="md" />
        <PricingDisplay price={89.99} originalPrice={119.99} size="sm" />
      </div>

      {/* Rules Validation */}
      <div>
        <h3 className="font-semibold mb-3">Validation Règles E-commerce</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800 mb-2">✅ Valide</p>
            <PricingDisplay price={89.99} originalPrice={119.99} />
            <p className="text-xs text-gray-600 mt-2">-25% (entre 5% et 70%)</p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800 mb-2">❌ Invalide (pas affiché)</p>
            <PricingDisplay price={89.99} originalPrice={300} />
            <p className="text-xs text-gray-600 mt-2">Prix barré &gt; +50% (suspect)</p>
          </div>
        </div>
      </div>

      {/* Price Comparison */}
      <div>
        <h3 className="font-semibold mb-3">Comparaison Concurrence</h3>
        <PriceComparison
          prices={[
            { label: "AutoMecanik", price: 89.99, isCurrent: true },
            { label: "Concurrent A", price: 109.99 },
            { label: "Concurrent B", price: 119.99 },
            { label: "Concessionnaire", price: 159.99 },
          ]}
        />
      </div>

      {/* Best Practices */}
      <div className="bg-orange-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 Règles Prix Barré:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Prix barré max +50% du prix actuel (crédibilité)</li>
          <li>• Réduction min 5%, max 70% (légal)</li>
          <li>• Afficher économies en € (ancrage mental)</li>
          <li>• Prix HT/TTC obligatoire (transparence)</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 💡 PRODUCT CARD COMPLET
// ═══════════════════════════════════════════════════════════════════════════

function ProductCardExample() {
  return (
    <div className="max-w-2xl border border-gray-200 rounded-lg overflow-hidden">
      {/* Image */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 text-sm">Image produit</span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Title + Badges */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Filtre à huile MANN-FILTER W712/75</h3>
          <TrustBadgeGroup badges={["oem", "warranty", "stock"]} variant="compact" />
        </div>

        {/* Social Proof */}
        <SocialProof soldCount={1247} reviewCount={389} rating={4.7} variant="compact" />

        {/* Pricing */}
        <PricingDisplay price={24.99} originalPrice={32.99} size="lg" />

        {/* Assurances */}
        <FrictionReducerGroup
          assurances={["return", "secure-payment", "satisfaction"]}
          variant="compact"
        />

        {/* CTA */}
        <Button className="w-full" size="lg">
          Ajouter au panier
        </Button>
      </div>
    </div>
  );
}
