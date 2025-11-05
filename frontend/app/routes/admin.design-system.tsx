/**
 * 🎨 DESIGN SYSTEM
 *
 * Route: /admin/design-system
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Separator } from "~/components/ui/separator";

export const meta: MetaFunction = () => {
  return [
    { title: "Design System - Guide de référence" },
    {
      name: "description",
      content: "Guide de référence rapide du Design System",
    },
  ];
};

type ActiveTab = "intro" | "colors" | "spacing" | "typo" | "patterns";
type CopyFn = (text: string, label: string) => void;

export default function SimpleDesignSystem() {
  const [copied, setCopied] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("intro");

  const copyToClipboard: CopyFn = (text, label) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        // optionnel: gérer une erreur de permissions
      });
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "intro", label: "📚 Introduction", icon: "📚" },
    { id: "colors", label: "🎨 Couleurs", icon: "🎨" },
    { id: "spacing", label: "📏 Espacements", icon: "📏" },
    { id: "typo", label: "✍️ Typographie", icon: "✍️" },
    { id: "patterns", label: "💡 Patterns", icon: "💡" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Navigation Breadcrumb */}
      <AdminBreadcrumb currentPage="Design System" />

      {/* Header */}
      <header className="space-y-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            🎨 Design Tokens
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            <strong>140+ tokens</strong> pour un design cohérent, maintenable et
            accessible.
          </p>
        </div>
      </header>

      {/* Intro "C'est quoi un design token ?" */}
      <IntroBlock />

      {/* Navigation Tabs */}
      <nav className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <section>
        {activeTab === "intro" && <IntroTab />}
        {activeTab === "colors" && (
          <ColorsTab copied={copied} copyToClipboard={copyToClipboard} />
        )}
        {activeTab === "spacing" && (
          <SpacingTab copied={copied} copyToClipboard={copyToClipboard} />
        )}
        {activeTab === "typo" && <TypographyTab />}
        {activeTab === "patterns" && (
          <PatternsTab copied={copied} copyToClipboard={copyToClipboard} />
        )}
      </section>

      {/* Component Examples – petite vitrine globale */}
      <ComponentExamples />

      {/* UI Components Demos */}
      <UIComponentsSection />

      {/* Resources */}
      <section className="bg-gray-50 rounded-lg p-6 border border-gray-200 space-y-2">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          📚 Ressources Design System
        </p>
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
          → Guide complet d&apos;utilisation
          <ExternalLink className="h-3 w-3" />
        </a>

        <ul className="mt-3 text-xs text-gray-600 list-disc list-inside space-y-1">
          <li>Une couleur = une fonction (CTA, succès, erreur, info, etc.).</li>
          <li>
            Utilise <code>font-heading</code> pour les titres,
            <code> font-sans</code> pour le body et
            <code> font-mono</code> pour les données techniques.
          </li>
        </ul>
      </section>
    </div>
  );
}

/* =========================================================================
 *  BLOCS / TABS
 * ========================================================================= */

function IntroBlock() {
  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 space-y-6">
      <div className="flex items-start gap-4">
        <div className="bg-blue-600 text-white p-3 rounded-lg">
          <Info className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">
            C&apos;est quoi les Design Tokens ?
          </h2>
          <p className="text-gray-700 text-base leading-relaxed">
            Les <strong>design tokens</strong> sont comme un{" "}
            <strong>dictionnaire universel de style</strong>. Au lieu d&apos;écrire{" "}
            <code className="bg-white px-2 py-1 rounded">#FF3B30</code> partout,
            tu utilises{" "}
            <code className="bg-white px-2 py-1 rounded">
              --color-primary-500
            </code>{" "}
            ou une classe utilitaire comme{" "}
            <code className="bg-white px-2 py-1 rounded">bg-primary-500</code>.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
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

// Si tu veux changer le rouge
// → chercher dans 500 fichiers ! 😱`}
          </pre>
        </div>

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

      <div className="bg-white rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Avantages des Design Tokens
        </h3>
        <ul className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
          <li>✅ Cohérence → Même design partout</li>
          <li>🔄 Maintenance → 1 changement = tout se met à jour</li>
          <li>📈 Scalabilité → Facile d&apos;ajouter des thèmes</li>
          <li>💬 Communication → Designers & devs parlent le même langage</li>
          <li>⚡ Performance → CSS variables → pas de rebuild</li>
          <li>♿ Accessibilité → Couleurs conformes WCAG AA/AAA</li>
        </ul>
      </div>
    </section>
  );
}

function IntroTab() {
  return (
    <div className="space-y-6">
      {/* Stats quick overview */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          {
            label: "Tokens Couleurs",
            value: "60+",
            icon: "🎨",
            color: "bg-red-50 border-red-200 text-red-700",
          },
          {
            label: "Espacements",
            value: "20+",
            icon: "📏",
            color: "bg-blue-50 border-blue-200 text-blue-700",
          },
          {
            label: "Typographie",
            value: "30+",
            icon: "✍️",
            color: "bg-purple-50 border-purple-200 text-purple-700",
          },
          {
            label: "Effets",
            value: "15+",
            icon: "✨",
            color: "bg-green-50 border-green-200 text-green-700",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.color} rounded-lg p-6 border-2 text-center`}
          >
            <div className="text-4xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold">🚀 Comment les utiliser ?</h2>

        <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
          <h3 className="font-bold text-green-900 mb-2">
            ✅ Méthode 1 : Classes utilitaires (RECOMMANDÉ)
          </h3>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {`<button className="bg-brand-500 text-white p-space-4 rounded-lg shadow-md">
  Mon Bouton
</button>`}
          </pre>
          <p className="text-sm text-green-800 mt-2">
            La plus simple et lisible : classes prêtes à l&apos;emploi.
          </p>
        </div>

        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
          <h3 className="font-bold text-blue-900 mb-2">
            Méthode 2 : CSS Variables
          </h3>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {`.mon-composant {
  background: var(--color-primary-500);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
}`}
          </pre>
        </div>

        <div className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg">
          <h3 className="font-bold text-purple-900 mb-2">
            Méthode 3 : TypeScript (logique métier)
          </h3>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {`import { designTokens } from '@fafa/design-tokens';

const primaryColor = designTokens.colors.primary[500];
const spacing = designTokens.spacing[4];`}
          </pre>
        </div>
      </div>

      {/* Architecture */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold">🏗️ Architecture du système</h2>
        <div className="bg-white rounded-lg p-4 font-mono text-sm">
          <pre className="overflow-x-auto">
            {`packages/design-tokens/
├── src/
│   ├── tokens/
│   │   └── design-tokens.json     ← 📝 Source unique de vérité
│   └── styles/
│       ├── tokens.css             ← 🎨 CSS Variables générées
│       └── utilities.css          ← ✨ Classes utilitaires
├── dist/                          ← 📦 Fichiers buildés
│   ├── tokens.css
│   ├── utilities.css
│   ├── generated.ts               ← 📘 Types TypeScript
│   └── tailwind.config.js         ← 🎨 Config Tailwind
└── scripts/
    └── build-tokens.js            ← ⚙️ Auto-génération`}
          </pre>
        </div>

        <div className="bg-white rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-2">Workflow :</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>
              Modifier{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                design-tokens.json
              </code>
            </li>
            <li>
              Lancer{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">npm run build</code>
            </li>
            <li>Tous les fichiers se régénèrent automatiquement 🎉</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function ColorsTab({
  copied,
  copyToClipboard,
}: {
  copied: string;
  copyToClipboard: CopyFn;
}) {
  const semanticColors = [
    {
      name: "Action",
      var: "--color-semantic-action",
      value: "#D63027",
      class: "bg-[var(--color-semantic-action)]",
      textClass: "text-[var(--color-semantic-action-contrast)]",
      usage: "Boutons CTA principaux uniquement",
      wcag: "AA (4.87:1)",
    },
    {
      name: "Info",
      var: "--color-semantic-info",
      value: "#0F4C81",
      class: "bg-[var(--color-semantic-info)]",
      textClass: "text-[var(--color-semantic-info-contrast)]",
      usage: "Navigation, liens, badges informatifs",
      wcag: "AAA (8.86:1)",
    },
    {
      name: "Success",
      var: "--color-semantic-success",
      value: "#1E8449",
      class: "bg-[var(--color-semantic-success)]",
      textClass: "text-[var(--color-semantic-success-contrast)]",
      usage: "Confirmations, messages de succès",
      wcag: "AA (4.72:1)",
    },
    {
      name: "Warning",
      var: "--color-semantic-warning",
      value: "#D68910",
      class: "bg-[var(--color-semantic-warning)]",
      textClass: "text-[var(--color-semantic-warning-contrast)]",
      usage: "Avertissements, attention",
      wcag: "AAA (7.44:1)",
    },
    {
      name: "Danger",
      var: "--color-semantic-danger",
      value: "#C0392B",
      class: "bg-[var(--color-semantic-danger)]",
      textClass: "text-[var(--color-semantic-danger-contrast)]",
      usage: "Erreurs, actions destructives",
      wcag: "AA (5.44:1)",
    },
    {
      name: "Neutral",
      var: "--color-semantic-neutral",
      value: "#4B5563",
      class: "bg-[var(--color-semantic-neutral)]",
      textClass: "text-[var(--color-semantic-neutral-contrast)]",
      usage: "États neutres, disabled",
      wcag: "AAA (7.56:1)",
    },
  ];

  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  return (
    <div className="space-y-6">
      {/* Semantic colors */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <h2 className="text-xl font-bold">
              Couleurs sémantiques (à utiliser en priorité)
            </h2>
            <p className="text-sm text-gray-700">
              Conformes WCAG AA/AAA – Accessibilité garantie.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {semanticColors.map((color) => (
            <div
              key={color.name}
              className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-primary-300 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-16 h-16 rounded-lg shadow-lg flex items-center justify-center font-bold text-sm ${color.class} ${color.textClass}`}
                >
                  {color.name}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-lg">
                    {color.name}
                  </p>
                  <code className="text-xs text-gray-600 block">
                    {color.value}
                  </code>
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded mt-1 font-medium">
                    {color.wcag}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-2">{color.usage}</p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    copyToClipboard(`var(${color.var})`, color.name)
                  }
                  className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs font-medium transition-colors"
                >
                  {copied === color.name ? "✓ Copié !" : "Copier CSS var"}
                </button>
                <button
                  onClick={() =>
                    copyToClipboard(color.class, `${color.name}-class`)
                  }
                  className="flex-1 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded text-xs font-medium transition-colors"
                >
                  {copied === `${color.name}-class`
                    ? "✓ Copié !"
                    : "Copier classe"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Palettes */}
      <section className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold">🎨 Palettes de couleurs</h2>
        <p className="text-sm text-gray-600">
          Pour les designs personnalisés, dégradés et états (hover, focus,
          active).
        </p>

        <div className="space-y-4">
          <PaletteRow label="Primary (Rouge)" prefix="primary" shades={shades} />
          <PaletteRow
            label="Secondary (Bleu)"
            prefix="secondary"
            shades={shades}
          />
          <PaletteRow label="Neutral (Gris)" prefix="neutral" shades={shades} />
        </div>
      </section>
    </div>
  );
}

function PaletteRow({
  label,
  prefix,
  shades,
}: {
  label: string;
  prefix: string;
  shades: number[];
}) {
  return (
    <div>
      <h3 className="font-semibold mb-2 text-gray-900">
        {label} – {shades.length} nuances
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {shades.map((shade) => (
          <div key={shade} className="flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-lg shadow-md bg-${prefix}-${shade} border border-gray-200`}
              title={`${prefix}-${shade}`}
            />
            <p className="text-xs text-center mt-1 font-mono">{shade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacingTab({
  copied,
  copyToClipboard,
}: {
  copied: string;
  copyToClipboard: CopyFn;
}) {
  const colorsRef = [
    {
      name: "Primary",
      value: "#FF3B30",
      class: "bg-primary-500",
      usage: "Boutons CTA",
    },
    {
      name: "Secondary",
      value: "#0F4C81",
      class: "bg-secondary-500",
      usage: "Navigation",
    },
    {
      name: "Success",
      value: "#27AE60",
      class: "bg-success",
      usage: "Validations",
    },
    {
      name: "Warning",
      value: "#F39C12",
      class: "bg-warning",
      usage: "Alertes",
    },
    {
      name: "Error",
      value: "#C0392B",
      class: "bg-error",
      usage: "Erreurs",
    },
    {
      name: "Info",
      value: "#3498DB",
      class: "bg-info",
      usage: "Informations",
    },
  ];

  const spacings = [
    { size: "xs", value: "4px", usage: "Micro-espaces (badges, icônes)" },
    { size: "sm", value: "8px", usage: "Label → input" },
    { size: "md", value: "16px", usage: "Padding cartes" },
    { size: "lg", value: "24px", usage: "Espacement entre sections" },
    { size: "xl", value: "32px", usage: "Grilles larges" },
    { size: "2xl", value: "40px", usage: "Layouts très aérés" },
    { size: "3xl", value: "48px", usage: "Hero sections" },
  ];

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold">🚀 Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              copyToClipboard(
                "cd packages/design-tokens && npm run build",
                "build"
              )
            }
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            {copied === "build" ? "✓ Copié !" : "📦 Build tokens"}
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
            {copied === "dev" ? "✓ Copié !" : "💻 Dev server"}
          </button>
        </div>
      </section>

      {/* Colors reference (compact) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">🎨 Couleurs (rappel rapide)</h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {colorsRef.map((color) => (
              <div
                key={color.name}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-lg ${color.class} shadow-md flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{color.name}</p>
                  <code className="text-xs text-gray-600 block">
                    {color.value}
                  </code>
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
      </section>

      {/* Spacing */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">📏 Espacements (8px grid)</h2>
        <div className="bg-white border rounded-lg p-4 space-y-2">
          {spacings.map((spacing) => (
            <div
              key={spacing.size}
              className="flex items-center gap-4 py-2 hover:bg-gray-50 px-2 rounded transition-colors"
            >
              <code className="w-20 text-sm font-mono font-semibold flex-shrink-0">
                p-{spacing.size}
              </code>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="bg-gray-100 rounded h-8 flex items-center px-2 flex-shrink-0 min-w-[200px]">
                  <div
                    className="bg-primary-500 h-6 rounded"
                    style={{ width: spacing.value }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-16 flex-shrink-0">
                  {spacing.value}
                </span>
              </div>
              <span className="text-sm text-gray-500 flex-1">
                {spacing.usage}
              </span>
              <button
                onClick={() =>
                  copyToClipboard(`p-${spacing.size}`, spacing.size)
                }
                className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                title="Copier la classe"
              >
                <Copy className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TypographyTab() {
  return (
    <div className="space-y-8">
      <section className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold mb-2">✍️ Typographie</h2>
        <p className="text-sm text-gray-600">
          Trois familles principales :{" "}
          <strong>font-heading</strong> (titres), <strong>font-sans</strong>{" "}
          (contenu) et <strong>font-mono</strong> (données techniques).
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Headings – Montserrat
              </p>
              <code className="text-xs bg-white px-2 py-1 rounded">
                font-heading
              </code>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-1">
              H1 – Page Produit Plaquettes de frein
            </h1>
            <p className="text-xs text-blue-700">
              Usage : titres de pages, H1/H2, sections clés.
            </p>
          </div>

          <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Body – Inter
              </p>
              <code className="text-xs bg-white px-2 py-1 rounded">
                font-sans
              </code>
            </div>
            <p className="font-sans text-base text-gray-900">
              Texte de description standard avec une lisibilité optimale pour le
              contenu principal de l&apos;application (fiches produits,
              catégories, pages CMS).
            </p>
            <p className="text-xs text-green-600 mt-2">
              Usage : paragraphes, descriptions, navigation, formulaires.
            </p>
          </div>

          <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                Monospace – Roboto Mono
              </p>
              <code className="text-xs bg-white px-2 py-1 rounded">
                font-mono
              </code>
            </div>
            <code className="font-mono text-base text-gray-900 block">
              OEM-7701208265
            </code>
            <p className="text-xs text-purple-600 mt-2">
              Usage : références, codes OEM, prix, IDs techniques.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PatternsTab({
  copied,
  copyToClipboard,
}: {
  copied: string;
  copyToClipboard: CopyFn;
}) {
  const patterns = [
    {
      label: "Bouton Primaire",
      code:
        "bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors",
      preview: "Ajouter au panier",
    },
    {
      label: "Bouton Secondaire",
      code:
        "bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors",
      preview: "En savoir plus",
    },
    {
      label: "Card Standard",
      code:
        "bg-white border border-gray-200 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow",
      preview: "Card",
    },
    {
      label: "Badge Success",
      code:
        "bg-success text-white px-3 py-1 rounded-full text-sm font-medium",
      preview: "✓ Compatible",
    },
    {
      label: "Badge Warning",
      code:
        "bg-warning text-black px-3 py-1 rounded-full text-sm font-medium",
      preview: "⚠ Stock faible",
    },
    {
      label: "Alert Info",
      code:
        "bg-info/10 border border-info text-info-foreground p-4 rounded-lg",
      preview: "Info: Livraison 24/48h",
    },
    {
      label: "Alert Warning",
      code:
        "bg-warning/10 border border-warning text-warning-foreground p-4 rounded-lg",
      preview: "Attention: Livraison sous 5–7 jours",
    },
    {
      label: "Input Standard",
      code:
        "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
      preview: "Input",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-bold mb-1">💡 Patterns réutilisables</h2>
        <p className="text-sm text-gray-600 mb-4">
          Copie/colle ces combinaisons de classes pour garder une UI cohérente
          sur tout le site (CTA, badges, alerts, inputs).
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {patterns.map((pattern, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-gray-900">{pattern.label}</p>
                  <code className="text-xs text-gray-700 bg-white px-2 py-1 rounded break-all block">
                    {pattern.code}
                  </code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(pattern.code, `pattern-${index}`)
                  }
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  {copied === `pattern-${index}` ? "✓ Copié" : "Copier"}
                </button>
              </div>

              {/* Preview */}
              <div className="mt-2">
                {pattern.preview === "Input" ? (
                  <input
                    className={pattern.code}
                    placeholder="Votre texte ici"
                  />
                ) : (
                  <div
                    className={pattern.code}
                    role="presentation"
                  >
                    {pattern.preview}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UIComponentsSection() {
  const components = [
    {
      name: "🔔 Sonner (Notifications)",
      description: "Système de notifications moderne avec toast.promise()",
      link: "/test/sonner",
      features: ["9 exemples interactifs", "Loading → Success/Error", "Actions personnalisées"],
      status: "✅ Intégré (react-hot-toast retiré)",
    },
    {
      name: "🍞 Breadcrumb",
      description: "Navigation fil d'Ariane pour contexte utilisateur",
      link: "/test/breadcrumb",
      features: ["6 exemples de navigation", "Séparateurs personnalisables", "Icônes & ellipsis"],
      status: "✅ Prêt à l'emploi",
    },
    {
      name: "🃏 Card & Separator",
      description: "Composants structurels pour organiser le contenu",
      link: "/test/card",
      features: ["Cards avec header/footer", "Separators H/V", "Exemples e-commerce"],
      status: "✅ Prêt à l'emploi",
    },
    {
      name: "📄 Sheet (Drawer)",
      description: "Panneau coulissant 4 directions pour cart, menu, filters",
      link: "/test/sheet",
      features: ["Panier e-commerce complet", "Menu mobile", "Options de livraison"],
      status: "✅ Prêt à l'emploi",
    },
  ];

  return (
    <section className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">🧩</span>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Composants UI Shadcn intégrés
          </h2>
          <p className="text-gray-700">
            Composants modernes avec démos interactives — Prêts pour production
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {components.map((component) => (
          <Link
            key={component.name}
            to={component.link}
            className="bg-white rounded-lg p-6 border-2 border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {component.name}
              </h3>
              <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              {component.description}
            </p>

            <div className="space-y-2 mb-3">
              {component.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs font-medium text-green-600">
                {component.status}
              </span>
              <span className="text-xs text-indigo-600 font-medium group-hover:underline">
                Voir la démo →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg p-4 border border-indigo-200">
        <p className="text-sm text-gray-700">
          <strong>📦 Stack technique :</strong> Shadcn UI (Radix + Tailwind) + Sonner + Lucide Icons
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Tous les composants sont accessibles (WCAG AA), responsive et personnalisables
        </p>
      </div>
    </section>
  );
}

function ComponentExamples() {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        🎨 Exemples de styles de base
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Boutons */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Boutons</p>
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

        {/* Badges */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Badges</p>
          <div className="flex flex-wrap gap-3">
            <span className="bg-success text-white px-3 py-1 rounded-full text-sm font-medium">
              ✓ Compatible
            </span>
            <span className="bg-warning text-black px-3 py-1 rounded-full text-sm font-medium">
              ⚠ Stock faible
            </span>
            <span className="bg-error text-white px-3 py-1 rounded-full text-sm font-medium">
              ✗ Incompatible
            </span>
            <span className="bg-info text-white px-3 py-1 rounded-full text-sm font-medium">
              ℹ Information
            </span>
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Alerts</p>
          <div className="space-y-3">
            <div className="bg-success/10 border border-success text-success-foreground p-4 rounded-lg text-sm">
              ✅ Opération réussie avec succès !
            </div>
            <div className="bg-warning/10 border border-warning text-warning-foreground p-4 rounded-lg text-sm">
              ⚠️ Attention : Livraison sous 5–7 jours
            </div>
            <div className="bg-error/10 border border-error text-error-foreground p-4 rounded-lg text-sm">
              ❌ Erreur : Cette pièce n&apos;est pas compatible
            </div>
          </div>
        </div>

        {/* Card produit */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Card Produit</p>
          <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 max-w-sm space-y-3">
            <h3 className="font-heading text-xl font-bold">
              Plaquettes de frein avant
            </h3>
            <p className="font-mono text-sm text-gray-600">
              Réf OEM: 7701208265
            </p>
            <span className="inline-flex bg-success text-white px-3 py-1 rounded-full text-sm font-medium">
              ✓ Compatible
            </span>
            <div className="font-mono text-3xl font-bold text-gray-900">
              45,99 €
            </div>
            <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-medium transition-colors">
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
