/**
 * Composant de démonstration du système de couleurs sémantiques
 * Affiche toutes les couleurs avec leurs rôles et contrastes WCAG
 */

import React from 'react';

const semanticColors = [
  {
    name: 'action',
    label: 'Action',
    role: 'CTA Unique (Boutons principaux)',
    wcag: 'AA (4.87:1)',
    usage: ['Boutons d\'action principaux', 'Boutons de soumission', 'Actions critiques'],
    avoid: ['Navigation secondaire', 'Liens de texte courant'],
  },
  {
    name: 'info',
    label: 'Info',
    role: 'Info/Navigation (Liens, badges info)',
    wcag: 'AAA (8.86:1)',
    usage: ['Liens de navigation', 'Badges informatifs', 'Tooltips', 'Messages informationnels'],
    avoid: ['CTA principaux', 'Messages d\'erreur'],
  },
  {
    name: 'success',
    label: 'Success',
    role: 'Confirmations & Validations',
    wcag: 'AA (4.72:1)',
    usage: ['Messages de succès', 'Confirmations d\'action', 'États validés'],
    avoid: ['Actions destructives', 'Navigation principale'],
  },
  {
    name: 'warning',
    label: 'Warning',
    role: 'Avertissements',
    wcag: 'AAA (7.44:1)',
    usage: ['Avertissements modérés', 'Actions importantes', 'Alertes de validation'],
    avoid: ['Erreurs critiques', 'Messages de succès'],
  },
  {
    name: 'danger',
    label: 'Danger',
    role: 'Erreurs & Actions destructives',
    wcag: 'AA (5.44:1)',
    usage: ['Messages d\'erreur', 'Actions destructives', 'États critiques'],
    avoid: ['CTA principaux', 'Avertissements légers'],
  },
  {
    name: 'neutral',
    label: 'Neutral',
    role: 'États neutres & Disabled',
    wcag: 'AAA (7.56:1)',
    usage: ['Boutons désactivés', 'Éléments inactifs', 'États neutres'],
    avoid: ['Éléments actionnables', 'Messages de statut'],
  },
];

export function ColorDemo() {
  return (
    <div className="p-8 space-y-12 bg-gray-50">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">
          🎨 Système de Couleurs Sémantiques
        </h1>
        <p className="text-lg text-gray-600">
          Toutes les couleurs sont conformes WCAG 2.1 Level AA minimum
        </p>
        <div className="mt-4 inline-flex gap-4">
          <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold">
            ✅ 6/6 Couleurs WCAG AA+
          </span>
          <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-semibold">
            ✨ 3/6 Couleurs WCAG AAA
          </span>
        </div>
      </div>

      {/* Color Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {semanticColors.map((color) => (
          <div
            key={color.name}
            className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
          >
            {/* Color Swatch */}
            <div
              style={{
                background: `var(--color-semantic-${color.name})`,
                color: `var(--color-semantic-${color.name}-contrast)`,
              }}
              className="p-6 text-center"
            >
              <h2 className="text-2xl font-bold mb-1">{color.label}</h2>
              <p className="text-sm opacity-90">{color.role}</p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-black/10 rounded-full text-xs font-mono">
                {color.wcag}
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              {/* CSS Variable */}
              <div>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
                  var(--color-semantic-{color.name})
                </code>
              </div>

              {/* Usage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  ✅ Utilisation
                </h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  {color.usage.map((use, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-green-500">•</span>
                      {use}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Avoid */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  ❌ À éviter
                </h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  {color.avoid.map((avoid, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-red-500">•</span>
                      {avoid}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Example Buttons */}
              <div className="pt-3 border-t space-y-2">
                <button
                  style={{
                    background: `var(--color-semantic-${color.name})`,
                    color: `var(--color-semantic-${color.name}-contrast)`,
                  }}
                  className="w-full px-4 py-2 rounded font-semibold hover:opacity-90 transition"
                >
                  Bouton {color.label}
                </button>
                <button
                  style={{
                    border: `2px solid var(--color-semantic-${color.name})`,
                    color: `var(--color-semantic-${color.name})`,
                  }}
                  className="w-full px-4 py-2 rounded font-semibold hover:bg-gray-50 transition"
                >
                  Variante Outline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Examples Section */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">💡 Exemples d'Usage</h2>

        <div className="space-y-6">
          {/* CTA Example */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">1. Call-to-Action Principal</h3>
            <div className="flex gap-3">
              <button
                style={{
                  background: 'var(--color-semantic-action)',
                  color: 'var(--color-semantic-action-contrast)',
                }}
                className="px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition"
              >
                Acheter Maintenant
              </button>
              <button
                style={{
                  background: 'var(--color-semantic-info)',
                  color: 'var(--color-semantic-info-contrast)',
                }}
                className="px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition"
              >
                En Savoir Plus
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              ✅ CTA unique en <strong>action</strong>, actions secondaires en <strong>info</strong>
            </p>
          </div>

          {/* Alert Examples */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">2. Alertes & Messages</h3>
            <div className="space-y-3">
              <div
                style={{
                  background: 'var(--color-semantic-success)',
                  color: 'var(--color-semantic-success-contrast)',
                }}
                className="p-4 rounded-lg"
              >
                <strong>✅ Succès:</strong> Votre commande a été confirmée avec succès.
              </div>
              <div
                style={{
                  background: 'var(--color-semantic-warning)',
                  color: 'var(--color-semantic-warning-contrast)',
                }}
                className="p-4 rounded-lg"
              >
                <strong>⚠️ Attention:</strong> Certains champs du formulaire sont incomplets.
              </div>
              <div
                style={{
                  background: 'var(--color-semantic-danger)',
                  color: 'var(--color-semantic-danger-contrast)',
                }}
                className="p-4 rounded-lg"
              >
                <strong>🚨 Erreur:</strong> Une erreur est survenue lors du paiement.
              </div>
              <div
                style={{
                  background: 'var(--color-semantic-info)',
                  color: 'var(--color-semantic-info-contrast)',
                }}
                className="p-4 rounded-lg"
              >
                <strong>ℹ️ Information:</strong> Votre commande sera livrée sous 3-5 jours.
              </div>
            </div>
          </div>

          {/* Badge Examples */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">3. Badges de Statut</h3>
            <div className="flex flex-wrap gap-3">
              <span
                style={{
                  background: 'var(--color-semantic-success)',
                  color: 'var(--color-semantic-success-contrast)',
                }}
                className="px-3 py-1 rounded-full text-sm font-semibold"
              >
                ✅ Validé
              </span>
              <span
                style={{
                  background: 'var(--color-semantic-warning)',
                  color: 'var(--color-semantic-warning-contrast)',
                }}
                className="px-3 py-1 rounded-full text-sm font-semibold"
              >
                ⏳ En attente
              </span>
              <span
                style={{
                  background: 'var(--color-semantic-danger)',
                  color: 'var(--color-semantic-danger-contrast)',
                }}
                className="px-3 py-1 rounded-full text-sm font-semibold"
              >
                ❌ Refusé
              </span>
              <span
                style={{
                  background: 'var(--color-semantic-neutral)',
                  color: 'var(--color-semantic-neutral-contrast)',
                }}
                className="px-3 py-1 rounded-full text-sm font-semibold"
              >
                ⚪ Inactif
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WCAG Compliance Table */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">📊 Conformité WCAG 2.1</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-semibold">Couleur</th>
                <th className="text-left py-3 px-4 font-semibold">Hex</th>
                <th className="text-left py-3 px-4 font-semibold">Texte</th>
                <th className="text-left py-3 px-4 font-semibold">Ratio</th>
                <th className="text-left py-3 px-4 font-semibold">Niveau WCAG</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Action</td>
                <td className="py-3 px-4 font-mono text-sm">#D63027</td>
                <td className="py-3 px-4 font-mono text-sm">#FFFFFF</td>
                <td className="py-3 px-4">4.87:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                    ✅ AA
                  </span>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Info</td>
                <td className="py-3 px-4 font-mono text-sm">#0F4C81</td>
                <td className="py-3 px-4 font-mono text-sm">#FFFFFF</td>
                <td className="py-3 px-4">8.86:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    ✅ AAA
                  </span>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Success</td>
                <td className="py-3 px-4 font-mono text-sm">#1E8449</td>
                <td className="py-3 px-4 font-mono text-sm">#FFFFFF</td>
                <td className="py-3 px-4">4.72:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                    ✅ AA
                  </span>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Warning</td>
                <td className="py-3 px-4 font-mono text-sm">#D68910</td>
                <td className="py-3 px-4 font-mono text-sm">#000000</td>
                <td className="py-3 px-4">7.44:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    ✅ AAA
                  </span>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Danger</td>
                <td className="py-3 px-4 font-mono text-sm">#C0392B</td>
                <td className="py-3 px-4 font-mono text-sm">#FFFFFF</td>
                <td className="py-3 px-4">5.44:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                    ✅ AA
                  </span>
                </td>
              </tr>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">Neutral</td>
                <td className="py-3 px-4 font-mono text-sm">#4B5563</td>
                <td className="py-3 px-4 font-mono text-sm">#FFFFFF</td>
                <td className="py-3 px-4">7.56:1</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    ✅ AAA
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-4">
          <strong>Note:</strong> WCAG AA nécessite un ratio minimum de 4.5:1 pour le texte normal, 
          WCAG AAA nécessite 7:1. Toutes nos couleurs respectent au minimum le niveau AA.
        </p>
      </div>
    </div>
  );
}

export default ColorDemo;
