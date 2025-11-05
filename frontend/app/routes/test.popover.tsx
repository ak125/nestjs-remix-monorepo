/**
 * Page de test pour les composants Popover
 * 
 * Cette page démontre les 3 types de popovers :
 * 1. UserActionsPopover - Actions contextuelles pour utilisateurs
 * 2. ProductQuickViewPopover - Aperçu rapide de produit
 * 3. DatePickerPopover - Sélecteur de date avec calendrier
 * 
 * URL: /test/popover
 */

import { type MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import {
  ChevronLeft,
  CheckCircle2,
  MoreVertical,
  Eye,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

import {
  DatePickerPopover,
} from '../components/forms/DatePickerPopover';
import {
  ProductQuickViewPopover,
  type ProductForQuickView,
} from '../components/products/ProductQuickViewPopover';
import {
  UserActionsPopover,
  type UserForActions,
} from '../components/users/UserActionsPopover';

export const meta: MetaFunction = () => {
  return [
    { title: 'Test Popover - Composants UI' },
    { name: 'description', content: 'Test des composants Popover' },
  ];
};

export default function TestPopoverPage() {
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();

  const logAction = (action: string) => {
    setActionLog((prev) => [`${new Date().toLocaleTimeString()} - ${action}`, ...prev.slice(0, 9)]);
  };

  // ============================================================
  // 1. UserActionsPopover - Mock data
  // ============================================================
  const mockUsers: UserForActions[] = [
    {
      id: 1,
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      isBlocked: false,
    },
    {
      id: 2,
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@example.com',
      isBlocked: false,
    },
    {
      id: 3,
      firstName: 'Pierre',
      lastName: 'Bernard',
      email: 'pierre.bernard@example.com',
      isBlocked: true,
    },
  ];

  // ============================================================
  // 2. ProductQuickViewPopover - Mock data
  // ============================================================
  const mockProducts: ProductForQuickView[] = [
    {
      id: 1,
      name: 'Amortisseurs avant Renault Clio 4',
      reference: 'REN-AMO-CLI4-001',
      price: 89.99,
      originalPrice: 119.99,
      stock: 15,
      rating: 4.5,
      reviewsCount: 28,
      category: 'Suspension',
      description:
        'Amortisseurs haute qualité pour Renault Clio 4. Installation facile, garantie 2 ans.',
      imageUrl: '/images/products/amortisseur-clio.jpg',
    },
    {
      id: 2,
      name: 'Plaquettes de frein Peugeot 208',
      reference: 'PEU-FRE-208-002',
      price: 45.50,
      stock: 3,
      rating: 5,
      reviewsCount: 42,
      category: 'Freinage',
      description:
        'Plaquettes de frein céramiques pour Peugeot 208. Performance optimale et durabilité.',
      imageUrl: '/images/products/plaquettes-208.jpg',
    },
    {
      id: 3,
      name: 'Filtre à air Citroën C3',
      reference: 'CIT-FIL-C3-003',
      price: 12.90,
      stock: 0,
      rating: 4,
      reviewsCount: 15,
      category: 'Filtration',
      description: 'Filtre à air haute filtration pour Citroën C3. Facile à installer.',
    },
    {
      id: 4,
      name: 'Batterie 12V 70Ah',
      reference: 'BAT-12V-70-004',
      price: 85.00,
      stock: 87,
      rating: 4.8,
      reviewsCount: 156,
      category: 'Électrique',
      description:
        'Batterie 12V 70Ah pour véhicules essence et diesel. Garantie 3 ans.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/test"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour aux tests
          </Link>
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            Composants Popover
          </h1>
          <p className="text-lg text-gray-600">
            Menus contextuels, aperçus et sélecteurs
          </p>
        </div>

        {/* Status Overview */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-green-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">3 Composants</h3>
            </div>
            <p className="text-sm text-gray-600">
              UserActions, QuickView & DatePicker
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Positionnement</h3>
            </div>
            <p className="text-sm text-gray-600">
              4 côtés + 3 alignements configurables
            </p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Interactif</h3>
            </div>
            <p className="text-sm text-gray-600">
              Click to open, click outside to close
            </p>
          </div>
        </div>

        {/* Action Log */}
        {actionLog.length > 0 && (
          <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-blue-900">
              📋 Log d'actions
            </h3>
            <div className="space-y-1">
              {actionLog.map((log, index) => (
                <div key={index} className="text-xs text-blue-800">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 1: UserActionsPopover */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-blue-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <MoreVertical className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                1. User Actions Popover
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Menu d'actions contextuelles pour les utilisateurs avec édition,
              visualisation, message, blocage et suppression.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Actions principales</strong> - Éditer, Voir, Message
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Modération</strong> - Bloquer/Débloquer, Supprimer
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Icônes colorées</strong> - Feedback visuel par action
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Configurable</strong> - Afficher/masquer actions
                </span>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Tableaux admin avec actions par ligne</li>
                <li>• Listes d'utilisateurs</li>
                <li>• Gestion de membres</li>
                <li>• Interface de modération</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Démo - Cliquez sur les icônes ⋮
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Utilisateur
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.isBlocked ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                            Bloqué
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <UserActionsPopover
                          user={user}
                          onEdit={() => logAction(`Éditer ${user.firstName} ${user.lastName}`)}
                          onViewProfile={() =>
                            logAction(`Voir profil de ${user.firstName}`)
                          }
                          onSendMessage={() =>
                            logAction(`Message à ${user.firstName}`)
                          }
                          onToggleBlock={() =>
                            logAction(
                              `${user.isBlocked ? 'Débloquer' : 'Bloquer'} ${user.firstName}`
                            )
                          }
                          onDelete={() =>
                            logAction(`Supprimer ${user.firstName}`)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 2: ProductQuickViewPopover */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-purple-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Eye className="h-6 w-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                2. Product Quick View Popover
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Aperçu rapide d'un produit avec image, prix, stock, note et actions
              sans quitter la page.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Image produit</strong> - Format aspect-video
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Badge réduction</strong> - Pourcentage si applicable
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Stock dynamique</strong> - Couleur selon disponibilité
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Actions rapides</strong> - Détails + Ajouter panier
                </span>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-purple-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-purple-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-purple-800">
                <li>• Catalogue produits (grilles)</li>
                <li>• Résultats de recherche</li>
                <li>• Suggestions de produits</li>
                <li>• Comparateur de prix</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Démo - Survolez les icônes 👁
            </h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {mockProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      {product.name.substring(0, 25)}...
                    </span>
                    <ProductQuickViewPopover
                      product={product}
                      onViewDetails={() =>
                        logAction(`Voir détails ${product.reference}`)
                      }
                      onAddToCart={() =>
                        logAction(`Ajouter au panier ${product.reference}`)
                      }
                      side="bottom"
                      align="end"
                    />
                  </div>
                  <div className="text-lg font-bold text-blue-600">
                    {product.price.toFixed(2)}€
                  </div>
                  <div className="text-xs text-gray-500">
                    Réf. {product.reference}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: DatePickerPopover */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                3. Date Picker Popover
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Sélecteur de date avec calendrier interactif, navigation par mois
              et désactivation de dates.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Calendrier</strong> - Vue mois avec grille 7x7
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Navigation</strong> - Mois précédent/suivant
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Restrictions</strong> - Min/max date, désactiver passé
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Raccourcis</strong> - Aujourd'hui, Effacer
                </span>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-green-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-green-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-green-800">
                <li>• Formulaires de réservation</li>
                <li>• Filtres de date (commandes, factures)</li>
                <li>• Sélection de date de naissance</li>
                <li>• Planification d'événements</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Démo - Sélectionnez une date
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Basic */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date de base
                </label>
                <DatePickerPopover
                  value={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date);
                    logAction(`Date sélectionnée: ${date.toLocaleDateString('fr-FR')}`);
                  }}
                  placeholder="Choisir une date"
                />
              </div>

              {/* Disable past */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date future uniquement
                </label>
                <DatePickerPopover
                  placeholder="Date future"
                  disablePast
                  onChange={(date) =>
                    logAction(`Date future: ${date.toLocaleDateString('fr-FR')}`)
                  }
                />
              </div>

              {/* With range */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date dans 30 jours
                </label>
                <DatePickerPopover
                  placeholder="30 prochains jours"
                  minDate={new Date()}
                  maxDate={
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  }
                  onChange={(date) =>
                    logAction(`Date limitée: ${date.toLocaleDateString('fr-FR')}`)
                  }
                />
              </div>
            </div>

            {selectedDate && (
              <div className="mt-6 rounded-lg bg-green-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-green-900">
                  Date sélectionnée
                </h4>
                <p className="text-sm text-green-800">
                  {selectedDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Documentation */}
        <section className="rounded-lg bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Documentation
          </h2>

          {/* Positioning */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Positionnement
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-900">
                      Prop
                    </th>
                    <th className="px-4 py-2 font-semibold text-gray-900">
                      Type
                    </th>
                    <th className="px-4 py-2 font-semibold text-gray-900">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2 font-mono text-blue-600">side</td>
                    <td className="px-4 py-2 text-gray-600">
                      'top' | 'right' | 'bottom' | 'left'
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      Côté où apparaît le popover
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-blue-600">align</td>
                    <td className="px-4 py-2 text-gray-600">
                      'start' | 'center' | 'end'
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      Alignement du popover
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-blue-600">
                      sideOffset
                    </td>
                    <td className="px-4 py-2 text-gray-600">number</td>
                    <td className="px-4 py-2 text-gray-700">
                      Distance en pixels du trigger
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Code Examples */}
          <div className="space-y-4">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Exemples de code
            </h3>

            {/* Example 1 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900">
                UserActionsPopover
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<UserActionsPopover
  user={user}
  onEdit={() => navigate(\`/admin/users/\${user.id}/edit\`)}
  onDelete={() => handleDelete(user.id)}
  side="bottom"
  align="end"
>
  <Button variant="ghost" size="icon">
    <MoreVertical />
  </Button>
</UserActionsPopover>`}
              </pre>
            </div>

            {/* Example 2 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900">
                ProductQuickViewPopover
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<ProductQuickViewPopover
  product={product}
  onViewDetails={() => navigate(\`/products/\${product.id}\`)}
  onAddToCart={() => addToCart(product.id)}
  side="right"
  align="start"
>
  <Button variant="outline" size="sm">
    <Eye />
  </Button>
</ProductQuickViewPopover>`}
              </pre>
            </div>

            {/* Example 3 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900">
                DatePickerPopover
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<DatePickerPopover
  value={selectedDate}
  onChange={setSelectedDate}
  placeholder="Sélectionner une date"
  disablePast
  minDate={new Date()}
  maxDate={new Date('2025-12-31')}
/>`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
