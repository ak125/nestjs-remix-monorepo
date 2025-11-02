/**
 * 🎨 DESIGN SYSTEM
 * 
 * Guide de référence rapide pour les développeurs
 * Route: /admin/design-system
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Design System - Guide de référence" },
    { name: "description", content: "Guide de référence rapide du Design System" },
  ];
};

export default function SimpleDesignSystem() {
  const [copied, setCopied] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>
        <h1 className="text-3xl font-bold">Design System</h1>
        <p className="text-gray-600 mt-2">Guide de référence rapide pour les développeurs</p>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="font-semibold mb-3">🚀 Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => copyToClipboard("cd packages/design-tokens && npm run build", "build")}
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            {copied === "build" ? "✓ Copié!" : "📦 Build tokens"}
          </button>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50 inline-flex items-center gap-2 transition-colors"
          >
            👁️ Preview app
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => copyToClipboard("npm run dev", "dev")}
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            {copied === "dev" ? "✓ Copié!" : "💻 Dev server"}
          </button>
        </div>
      </div>

      {/* Colors Reference */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🎨 Couleurs</h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Primary", value: "#FF3B30", class: "bg-primary-500", usage: "Boutons CTA" },
              { name: "Secondary", value: "#0F4C81", class: "bg-secondary-500", usage: "Navigation" },
              { name: "Success", value: "#27AE60", class: "bg-success", usage: "Validations" },
              { name: "Warning", value: "#F39C12", class: "bg-warning", usage: "Alertes" },
              { name: "Error", value: "#C0392B", class: "bg-error", usage: "Erreurs" },
              { name: "Info", value: "#3498DB", class: "bg-info", usage: "Informations" }
            ].map((color) => (
              <div key={color.name} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className={`w-12 h-12 rounded-lg ${color.class} shadow-md flex-shrink-0`}></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{color.name}</p>
                  <code className="text-xs text-gray-600 block">{color.value}</code>
                  <p className="text-xs text-gray-500">{color.usage}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(color.class, color.name)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  title="Copier la classe"
                >
                  <Copy className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spacing Reference */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">📏 Espacements (8px Grid)</h2>
        <div className="bg-white border rounded-lg p-4 space-y-3">
          {[
            { size: "xs", value: "4px", usage: "Micro-espaces (badges, icônes)" },
            { size: "sm", value: "8px", usage: "Espacement serré (label → input)" },
            { size: "md", value: "16px", usage: "Standard (padding cartes)" },
            { size: "lg", value: "24px", usage: "Sections, blocs" },
            { size: "xl", value: "32px", usage: "Grandes marges, grilles" },
            { size: "2xl", value: "40px", usage: "Large grilles" },
            { size: "3xl", value: "48px", usage: "Hero sections" }
          ].map((spacing) => (
            <div key={spacing.size} className="flex items-center gap-4 py-2 hover:bg-gray-50 px-2 rounded transition-colors">
              <code className="w-20 text-sm font-mono font-semibold flex-shrink-0">p-{spacing.size}</code>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="bg-gray-100 rounded h-8 flex items-center px-2 flex-shrink-0" style={{ minWidth: '200px' }}>
                  <div 
                    className="bg-primary-500 h-6 rounded"
                    style={{ width: spacing.value }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-16 flex-shrink-0">{spacing.value}</span>
              </div>
              <span className="text-sm text-gray-500 flex-1">{spacing.usage}</span>
              <button
                onClick={() => copyToClipboard(`p-${spacing.size}`, spacing.size)}
                className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                title="Copier la classe"
              >
                <Copy className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">✍️ Typographie</h2>
        <div className="bg-white border rounded-lg p-4 space-y-4">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Headings - Montserrat</p>
              <code className="text-xs bg-white px-2 py-1 rounded">font-heading</code>
            </div>
            <h1 className="font-heading font-bold text-3xl text-gray-900 mb-2">Titre Principal H1</h1>
            <h2 className="font-heading font-bold text-2xl text-gray-800">Sous-titre H2</h2>
            <p className="text-xs text-blue-600 mt-2">Usage: Titres, headers, navigation principale</p>
          </div>

          <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Body - Inter</p>
              <code className="text-xs bg-white px-2 py-1 rounded">font-sans</code>
            </div>
            <p className="font-sans text-base text-gray-900">
              Texte de description standard avec une lisibilité optimale pour le contenu principal de l'application.
            </p>
            <p className="text-xs text-green-600 mt-2">Usage: Paragraphes, descriptions, contenu informatif</p>
          </div>

          <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Data - Roboto Mono</p>
              <code className="text-xs bg-white px-2 py-1 rounded">font-mono</code>
            </div>
            <div className="space-y-1">
              <code className="font-mono text-sm text-gray-900 block">Réf OEM: 7701208265</code>
              <code className="font-mono text-sm text-gray-900 block">Stock: 42 unités | Prix: 149,99 €</code>
            </div>
            <p className="text-xs text-purple-600 mt-2">Usage: Codes, références, données techniques, prix</p>
          </div>
        </div>
      </div>

      {/* Common Patterns */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">💡 Patterns courants (Copy-Paste Ready)</h2>
        <div className="bg-white border rounded-lg p-4 space-y-3">
          {[
            {
              label: "Bouton CTA Principal",
              code: "bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors",
              preview: "Ajouter au panier"
            },
            {
              label: "Bouton Secondaire",
              code: "bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors",
              preview: "En savoir plus"
            },
            {
              label: "Card Standard",
              code: "bg-white border border-gray-200 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow",
              preview: "Card"
            },
            {
              label: "Badge Success",
              code: "bg-success text-white px-3 py-1 rounded-full text-sm font-medium",
              preview: "✓ Compatible"
            },
            {
              label: "Badge Warning",
              code: "bg-warning text-black px-3 py-1 rounded-full text-sm font-medium",
              preview: "⚠ Stock faible"
            },
            {
              label: "Alert Info",
              code: "bg-info/10 border border-info text-info-foreground p-4 rounded-lg",
              preview: "Info"
            },
            {
              label: "Alert Warning",
              code: "bg-warning/10 border border-warning text-warning-foreground p-4 rounded-lg",
              preview: "Attention"
            },
            {
              label: "Input Standard",
              code: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
              preview: "Input"
            }
          ].map((pattern, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-2">{pattern.label}</p>
                  <code className="text-xs text-gray-700 bg-white px-2 py-1 rounded break-all block">
                    {pattern.code}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(pattern.code, `pattern-${index}`)}
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  {copied === `pattern-${index}` ? "✓ Copié" : "Copier"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component Examples */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🎨 Exemples visuels</h2>
        <div className="bg-white border rounded-lg p-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Boutons</p>
            <div className="flex flex-wrap gap-3">
              <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Primary Button
              </button>
              <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Secondary
              </button>
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors">
                Outline
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Badges</p>
            <div className="flex flex-wrap gap-3">
              <span className="bg-success text-white px-3 py-1 rounded-full text-sm font-medium">✓ Compatible</span>
              <span className="bg-warning text-black px-3 py-1 rounded-full text-sm font-medium">⚠ Stock faible</span>
              <span className="bg-error text-white px-3 py-1 rounded-full text-sm font-medium">✗ Incompatible</span>
              <span className="bg-info text-white px-3 py-1 rounded-full text-sm font-medium">ℹ Information</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Alerts</p>
            <div className="space-y-3">
              <div className="bg-success/10 border border-success text-success-foreground p-4 rounded-lg">
                ✅ Opération réussie avec succès !
              </div>
              <div className="bg-warning/10 border border-warning text-warning-foreground p-4 rounded-lg">
                ⚠️ Attention: Livraison sous 5-7 jours
              </div>
              <div className="bg-error/10 border border-error text-error-foreground p-4 rounded-lg">
                ❌ Erreur: Cette pièce n'est pas compatible
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Card Produit</p>
            <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 max-w-sm">
              <h3 className="font-heading text-xl font-bold mb-2">Plaquettes de frein avant</h3>
              <p className="font-mono text-sm text-gray-600 mb-2">Réf OEM: 7701208265</p>
              <span className="inline-flex bg-success text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
                ✓ Compatible
              </span>
              <div className="font-mono text-3xl font-bold text-gray-900 mb-4">45,99 €</div>
              <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-medium transition-colors">
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">📚 Ressources</h2>
        <div className="space-y-3">
          <a 
            href="https://tailwindcss.com/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            → Documentation Tailwind CSS
            <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/packages/design-tokens/README.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            → README du package @fafa/design-tokens
            <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/DESIGN-SYSTEM-USAGE-GUIDE.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            → Guide d'utilisation complet
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">💡 Bonnes pratiques</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Utilisez toujours les classes de tokens plutôt que des valeurs hardcodées</li>
              <li>• Respectez la grille d'espacement 8px (xs, sm, md, lg, xl)</li>
              <li>• Une couleur = une fonction (Primary pour CTA, Success pour validation, etc.)</li>
              <li>• Préférez font-heading pour les titres, font-sans pour le body, font-mono pour les données</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
