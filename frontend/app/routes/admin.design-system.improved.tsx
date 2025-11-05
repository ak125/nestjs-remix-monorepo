/**
 * 🎨 DESIGN SYSTEM - VERSION AMÉLIORÉE
 * 
 * Guide complet et pédagogique des design tokens
 * Route: /admin/design-system
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ArrowLeft, ExternalLink, Info, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Design System - Guide Complet" },
    { name: "description", content: "Guide complet des design tokens - 140+ tokens pour un design cohérent" },
  ];
};

export default function ImprovedDesignSystem() {
  const [copied, setCopied] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
          🎨 Design Tokens
        </h1>
        <p className="text-gray-600 text-lg">
          <strong>140+ tokens</strong> pour un design cohérent et maintenable
        </p>
      </div>

      {/* Intro Section - C'est quoi les tokens? */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 mb-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-blue-600 text-white p-3 rounded-lg flex-shrink-0">
            <Info className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              C'est quoi les Design Tokens ?
            </h2>
            <p className="text-gray-700 text-base leading-relaxed mb-4">
              Les <strong>design tokens</strong> sont comme un <strong>dictionnaire universel de style</strong>. 
              Au lieu d'écrire <code className="bg-white px-2 py-1 rounded">#FF3B30</code> partout, 
              vous utilisez <code className="bg-white px-2 py-1 rounded">--color-primary-500</code>.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Without Tokens */}
          <div className="bg-white rounded-lg p-6 border-2 border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">❌</span>
              <h3 className="font-bold text-red-700">Sans Design Tokens</h3>
            </div>
            <pre className="bg-red-50 p-4 rounded text-sm overflow-x-auto">
{`<div style={{ 
  color: '#FF3B30',
  padding: '16px',
  borderRadius: '8px'
}}>
  Button
</div>

// Si vous voulez changer le rouge
// → chercher dans 500 fichiers ! 😱`}
            </pre>
          </div>

          {/* With Tokens */}
          <div className="bg-white rounded-lg p-6 border-2 border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✅</span>
              <h3 className="font-bold text-green-700">Avec Design Tokens</h3>
            </div>
            <pre className="bg-green-50 p-4 rounded text-sm overflow-x-auto">
{`<div className="
  text-brand-500 
  p-space-4 
  rounded-lg
">
  Button
</div>

// Changement = 1 seul fichier ! 😍`}
            </pre>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Avantages des Design Tokens
          </h3>
          <ul className="grid md:grid-cols-2 gap-3">
            {[
              "✅ Cohérence → Même design partout",
              "🔄 Maintenance → 1 changement = tout se met à jour",
              "📈 Scalabilité → Facile d'ajouter des thèmes",
              "💬 Communication → Designers et devs parlent le même langage",
              "⚡ Performance → CSS Variables = pas de rebuild",
              "♿ Accessibilité → Conformité WCAG AA/AAA garantie"
            ].map((benefit, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Tokens Couleurs", value: "60+", icon: "🎨", color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Espacements", value: "20+", icon: "📏", color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Typographie", value: "30+", icon: "✍️", color: "bg-purple-50 border-purple-200 text-purple-700" },
          { label: "Effets", value: "15+", icon: "✨", color: "bg-green-50 border-green-200 text-green-700" }
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-lg p-6 border-2 text-center`}>
            <div className="text-4xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">🚀 Comment les utiliser ?</h2>
        <div className="space-y-4">
          <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-green-900">✅ Méthode 1 : Classes Utilitaires (RECOMMANDÉ)</h3>
              <button
                onClick={() => copyToClipboard('<button className="bg-brand-500 text-white p-space-4 rounded-lg">Mon Bouton</button>', 'method1')}
                className="px-3 py-1 bg-white border border-green-300 rounded text-sm hover:bg-green-50"
              >
                {copied === 'method1' ? '✓ Copié!' : 'Copier'}
              </button>
            </div>
            <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
{`<button className="bg-brand-500 text-white p-space-4 rounded-lg shadow-md">
  Mon Bouton
</button>`}
            </pre>
            <p className="text-sm text-green-800 mt-2">
              Le plus simple et lisible ! Classes prêtes à l'emploi.
            </p>
          </div>

          <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
            <h3 className="font-bold text-blue-900 mb-2">Méthode 2 : CSS Variables</h3>
            <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
{`.mon-composant {
  background: var(--color-primary-500);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
}`}
            </pre>
          </div>

          <div className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg">
            <h3 className="font-bold text-purple-900 mb-2">Méthode 3 : TypeScript (pour logique)</h3>
            <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
{`import { designTokens } from '@fafa/design-tokens';

const primaryColor = designTokens.colors.primary[500];
const spacing = designTokens.spacing[4];`}
            </pre>
          </div>
        </div>
      </div>

      {/* Semantic Colors - MOST IMPORTANT! */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⭐</span>
          <div>
            <h2 className="text-2xl font-bold">Couleurs Sémantiques</h2>
            <p className="text-sm text-gray-700">TOUJOURS utiliser en priorité! Conformes WCAG AA/AAA</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { 
              name: "Action", 
              var: "--color-semantic-action",
              value: "#D63027", 
              class: "bg-[var(--color-semantic-action)]",
              textClass: "text-[var(--color-semantic-action-contrast)]",
              usage: "Boutons CTA principaux uniquement",
              wcag: "AA (4.87:1)"
            },
            { 
              name: "Info", 
              var: "--color-semantic-info",
              value: "#0F4C81", 
              class: "bg-[var(--color-semantic-info)]",
              textClass: "text-[var(--color-semantic-info-contrast)]",
              usage: "Navigation, liens, badges informatifs",
              wcag: "AAA (8.86:1)"
            },
            { 
              name: "Success", 
              var: "--color-semantic-success",
              value: "#1E8449", 
              class: "bg-[var(--color-semantic-success)]",
              textClass: "text-[var(--color-semantic-success-contrast)]",
              usage: "Confirmations, messages de succès",
              wcag: "AA (4.72:1)"
            },
            { 
              name: "Warning", 
              var: "--color-semantic-warning",
              value: "#D68910", 
              class: "bg-[var(--color-semantic-warning)]",
              textClass: "text-[var(--color-semantic-warning-contrast)]",
              usage: "Avertissements, attention",
              wcag: "AAA (7.44:1)"
            },
            { 
              name: "Danger", 
              var: "--color-semantic-danger",
              value: "#C0392B", 
              class: "bg-[var(--color-semantic-danger)]",
              textClass: "text-[var(--color-semantic-danger-contrast)]",
              usage: "Erreurs, actions destructives",
              wcag: "AA (5.44:1)"
            },
            { 
              name: "Neutral", 
              var: "--color-semantic-neutral",
              value: "#4B5563", 
              class: "bg-[var(--color-semantic-neutral)]",
              textClass: "text-[var(--color-semantic-neutral-contrast)]",
              usage: "États neutres, disabled",
              wcag: "AAA (7.56:1)"
            }
          ].map((color) => (
            <div key={color.name} className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-primary-300 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-16 h-16 rounded-lg ${color.class} ${color.textClass} shadow-lg flex items-center justify-center font-bold text-sm`}>
                  {color.name}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-lg">{color.name}</p>
                  <code className="text-xs text-gray-600 block">{color.value}</code>
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded mt-1 font-medium">
                    {color.wcag}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-2">{color.usage}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(`var(${color.var})`, color.name)}
                  className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs font-medium transition-colors"
                >
                  {copied === color.name ? "✓ Copié!" : "CSS var"}
                </button>
                <button
                  onClick={() => copyToClipboard(color.class, `${color.name}-class`)}
                  className="flex-1 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded text-xs font-medium transition-colors"
                >
                  {copied === `${color.name}-class` ? "✓ Copié!" : "Classe"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-bold mb-3">🚀 Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => copyToClipboard("cd packages/design-tokens && npm run build", "build")}
            className="px-4 py-2 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
          >
            {copied === "build" ? "✓ Copié!" : "📦 Build tokens"}
          </button>
          <Link
            to="/ui-kit"
            className="px-4 py-2 bg-white border border-blue-300 rounded hover:bg-blue-50 inline-flex items-center gap-2 transition-colors"
          >
            👁️ Voir UI Kit
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={() => copyToClipboard("npm run dev", "dev")}
            className="px-4 py-2 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
          >
            {copied === "dev" ? "✓ Copié!" : "💻 Dev server"}
          </button>
        </div>
      </div>

      {/* Ressources */}
      <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold mb-4">📚 Ressources</h2>
        <div className="space-y-3">
          <Link 
            to="/ui-kit/colors"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            → Voir toutes les couleurs dans l'UI Kit
            <ExternalLink className="h-3 w-3" />
          </Link>
          <a 
            href="https://tailwindcss.com/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            → Documentation Tailwind CSS
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-2">💡 Bonnes pratiques</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Utilisez toujours les classes de tokens plutôt que des valeurs hardcodées</li>
              <li>• Respectez la sémantique des couleurs (Action pour CTA, Success pour validation, etc.)</li>
              <li>• Respectez la grille d'espacement 8px (xs, sm, md, lg, xl)</li>
              <li>• Préférez font-heading pour les titres, font-sans pour le body, font-mono pour les données</li>
              <li>• Testez toujours l'accessibilité avec les contrastes automatiques</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
