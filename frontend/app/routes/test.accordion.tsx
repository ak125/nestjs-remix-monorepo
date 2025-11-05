/**
 * Page de test pour les composants Accordion
 * 
 * Cette page démontre les 3 types d'accordéons :
 * 1. FAQAccordion - Pour pages FAQ avec recherche
 * 2. FilterAccordion - Pour filtres de catalogue
 * 3. SettingsAccordion - Pour paramètres admin
 * 
 * URL: /test/accordion
 */

import { type MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { ChevronLeft, CheckCircle2, Search, Filter, Settings } from 'lucide-react';
import { useState } from 'react';
import {
  SettingsAccordion,
  type AllSettings,
} from '../components/admin/SettingsAccordion';
import {
  FilterAccordion,
  type FilterData,
} from '../components/catalog/FilterAccordion';
import {
  FAQAccordion,
  type FAQCategory,
} from '../components/faq/FAQAccordion';

export const meta: MetaFunction = () => {
  return [
    { title: 'Test Accordion - Composants UI' },
    { name: 'description', content: 'Test des composants Accordion' },
  ];
};

export default function TestAccordionPage() {
  // ============================================================
  // 1. FAQ Accordion - Mock data
  // ============================================================
  const faqCategories: FAQCategory[] = [
    {
      name: 'Commandes & Livraison',
      questions: [
        {
          question: 'Comment passer une commande ?',
          answer:
            'Pour passer commande, ajoutez les articles à votre panier, cliquez sur "Commander" et suivez les étapes : connexion, adresse de livraison, mode de paiement, confirmation.',
        },
        {
          question: 'Quels sont les délais de livraison ?',
          answer:
            'Les délais varient selon votre localisation : 24-48h en France métropolitaine, 3-5 jours pour la Corse et DOM-TOM. Livraison express disponible (sous 24h).',
        },
        {
          question: 'Puis-je modifier ma commande après validation ?',
          answer:
            'Vous avez 1 heure après validation pour modifier votre commande en contactant le service client. Passé ce délai, la commande est en préparation.',
        },
        {
          question: 'Comment suivre ma commande ?',
          answer:
            'Un email avec le numéro de suivi vous est envoyé dès l\'expédition. Vous pouvez aussi consulter l\'état dans votre espace "Mes commandes".',
        },
      ],
    },
    {
      name: 'Paiement & Facturation',
      questions: [
        {
          question: 'Quels moyens de paiement acceptez-vous ?',
          answer:
            'Nous acceptons : Carte bancaire (Visa, Mastercard, Amex), PayPal, virement bancaire, et paiement en 3x sans frais (à partir de 100€).',
        },
        {
          question: 'Mes données bancaires sont-elles sécurisées ?',
          answer:
            'Oui, tous les paiements sont cryptés en SSL 256 bits. Nous utilisons le protocole 3D Secure et ne conservons jamais vos données bancaires.',
        },
        {
          question: 'Puis-je obtenir une facture ?',
          answer:
            'Une facture est automatiquement générée et envoyée par email après chaque commande. Vous pouvez la télécharger depuis votre espace client.',
        },
      ],
    },
    {
      name: 'Retours & Remboursements',
      questions: [
        {
          question: 'Quelle est votre politique de retour ?',
          answer:
            'Vous disposez de 30 jours pour retourner un article. Les frais de retour sont à votre charge sauf en cas de défaut ou erreur de notre part.',
        },
        {
          question: 'Comment obtenir un remboursement ?',
          answer:
            'Après réception de votre retour, nous procédons au remboursement sous 3-5 jours ouvrés sur le moyen de paiement utilisé lors de l\'achat.',
        },
        {
          question: 'Puis-je échanger un article ?',
          answer:
            'Oui, contactez le service client avec votre numéro de commande. Nous organisons l\'échange sans frais supplémentaires si l\'article est en stock.',
        },
      ],
    },
    {
      name: 'Compte & Sécurité',
      questions: [
        {
          question: 'Comment créer un compte ?',
          answer:
            'Cliquez sur "S\'inscrire" en haut à droite, renseignez vos informations (email, mot de passe) et validez le lien reçu par email.',
        },
        {
          question: 'J\'ai oublié mon mot de passe, que faire ?',
          answer:
            'Cliquez sur "Mot de passe oublié" sur la page de connexion. Un email vous sera envoyé avec un lien pour réinitialiser votre mot de passe.',
        },
        {
          question: 'Comment modifier mes informations personnelles ?',
          answer:
            'Connectez-vous à votre compte, allez dans "Mon profil" puis "Modifier mes informations". N\'oubliez pas d\'enregistrer les modifications.',
        },
      ],
    },
  ];

  // ============================================================
  // 2. Filter Accordion - Mock data
  // ============================================================
  const [filterData, setFilterData] = useState<FilterData>({
    priceRange: {
      min: 0,
      max: 500,
      currentMin: 50,
      currentMax: 300,
    },
    brands: [
      { id: 'renault', label: 'Renault', count: 234, selected: true } as any,
      { id: 'peugeot', label: 'Peugeot', count: 189, selected: false } as any,
      { id: 'citroen', label: 'Citroën', count: 156, selected: true } as any,
      { id: 'bosch', label: 'Bosch', count: 312, selected: false } as any,
      { id: 'valeo', label: 'Valeo', count: 278, selected: false } as any,
    ],
    categories: [
      { id: 'freinage', label: 'Freinage', count: 145, selected: false } as any,
      { id: 'suspension', label: 'Suspension', count: 98, selected: false } as any,
      { id: 'filtration', label: 'Filtration', count: 187, selected: true } as any,
      { id: 'eclairage', label: 'Éclairage', count: 76, selected: false } as any,
      { id: 'batterie', label: 'Batterie', count: 54, selected: false } as any,
    ],
    availability: {
      inStockOnly: true,
    },
  });

  const activeFiltersCount =
    (filterData.brands?.filter((b: any) => b.selected).length || 0) +
    (filterData.categories?.filter((c: any) => c.selected).length || 0) +
    (filterData.availability?.inStockOnly ? 1 : 0) +
    ((filterData.priceRange?.currentMin !== filterData.priceRange?.min ||
      filterData.priceRange?.currentMax !== filterData.priceRange?.max)
      ? 1
      : 0);

  const handleFilterChange = (newFilters: FilterData) => {
    setFilterData(newFilters);
    console.log('Filtres mis à jour:', newFilters);
  };

  const handleResetFilters = () => {
    setFilterData({
      ...filterData,
      priceRange: {
        ...filterData.priceRange!,
        currentMin: filterData.priceRange!.min,
        currentMax: filterData.priceRange!.max,
      },
      brands: filterData.brands?.map((b) => ({ ...b, selected: false } as any)),
      categories: filterData.categories?.map((c) => ({
        ...c,
        selected: false,
      } as any)),
      availability: { inStockOnly: false },
    });
  };

  // ============================================================
  // 3. Settings Accordion - Mock data
  // ============================================================
  const [settings, setSettings] = useState<AllSettings>({
    account: {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '+33 6 12 34 56 78',
      language: 'fr',
    },
    notifications: {
      emailOrders: true,
      emailPromotions: false,
      emailNewsletter: true,
      pushNotifications: true,
      smsNotifications: false,
    },
    security: {
      twoFactorEnabled: true,
      sessionTimeout: 30,
      showLoginHistory: true,
      allowMultipleSessions: false,
    },
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSettingChange = (newSettings: AllSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    console.log('Paramètres modifiés:', newSettings);
  };

  const handleSaveSettings = () => {
    console.log('Sauvegarde des paramètres:', settings);
    setHasUnsavedChanges(false);
    // Ici : appel API pour sauvegarder
  };

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
            Composants Accordion
          </h1>
          <p className="text-lg text-gray-600">
            Sections pliables pour FAQ, filtres et paramètres
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
              FAQ, Filters & Settings accordions
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Animations</h3>
            </div>
            <p className="text-sm text-gray-600">
              Ouverture/fermeture fluides avec Radix UI
            </p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Accessible</h3>
            </div>
            <p className="text-sm text-gray-600">
              Clavier (Tab, Enter, ↑↓) et lecteurs d'écran
            </p>
          </div>
        </div>

        {/* Section 1: FAQ Accordion */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-blue-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Search className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                1. FAQ Accordion
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Accordéon pour pages FAQ avec recherche en temps réel et
              catégorisation.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Recherche instantanée</strong> - Filtre questions et
                  réponses
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Catégories</strong> - Organisation par thèmes
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Single mode</strong> - Une seule question ouverte
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Compteurs</strong> - Nombre de Q/R par catégorie
                </span>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Page FAQ principale</li>
                <li>• Centre d'aide et documentation</li>
                <li>• Guides d'onboarding</li>
                <li>• Support client self-service</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <FAQAccordion
              categories={faqCategories}
              searchable
              singleMode
            />
          </div>
        </section>

        {/* Section 2: Filter Accordion */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-purple-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Filter className="h-6 w-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                2. Filter Accordion
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Accordéon pour filtres de catalogue avec prix, marques, catégories
              et disponibilité.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Range slider</strong> - Filtre de prix min/max
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Multi-sélection</strong> - Marques et catégories
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Compteurs</strong> - Nombre de produits par filtre
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Reset</strong> - Réinitialisation globale ou par
                  section
                </span>
              </div>
            </div>

            {/* State Display */}
            <div className="mb-4 rounded-lg bg-purple-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-purple-900">
                État actuel ({activeFiltersCount} filtres actifs)
              </h3>
              <div className="space-y-1 text-sm text-purple-800">
                <div>
                  <strong>Prix:</strong> {filterData.priceRange?.currentMin}€ -{' '}
                  {filterData.priceRange?.currentMax}€
                </div>
                <div>
                  <strong>Marques:</strong>{' '}
                  {filterData.brands
                    ?.filter((b: any) => b.selected)
                    .map((b) => b.label)
                    .join(', ') || 'Aucune'}
                </div>
                <div>
                  <strong>Catégories:</strong>{' '}
                  {filterData.categories
                    ?.filter((c: any) => c.selected)
                    .map((c) => c.label)
                    .join(', ') || 'Aucune'}
                </div>
                <div>
                  <strong>En stock uniquement:</strong>{' '}
                  {filterData.availability?.inStockOnly ? 'Oui' : 'Non'}
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-purple-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-purple-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-purple-800">
                <li>• Sidebar de catalogue produits</li>
                <li>• Page de recherche avancée</li>
                <li>• Filtres de marketplace</li>
                <li>• Dashboard analytique</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <FilterAccordion
              filters={filterData}
              onFilterChange={handleFilterChange}
              activeFiltersCount={activeFiltersCount}
              onResetAll={handleResetFilters}
            />
          </div>
        </section>

        {/* Section 3: Settings Accordion */}
        <section className="mb-12">
          <div className="mb-6 rounded-lg border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Settings className="h-6 w-6 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                3. Settings Accordion
              </h2>
            </div>
            <p className="mb-4 text-gray-600">
              Accordéon pour paramètres utilisateur avec compte, notifications et
              sécurité.
            </p>

            {/* Features */}
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>3 sections</strong> - Compte, Notifications, Sécurité
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Formulaires</strong> - Inputs, selects, checkboxes
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Indicateur</strong> - Changements non sauvegardés
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong>Icônes colorées</strong> - Visual feedback par section
                </span>
              </div>
            </div>

            {/* Use Cases */}
            <div className="rounded-lg bg-green-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-green-900">
                Cas d'usage
              </h3>
              <ul className="space-y-1 text-sm text-green-800">
                <li>• Page de paramètres utilisateur</li>
                <li>• Préférences admin</li>
                <li>• Configuration d'application</li>
                <li>• Profil client</li>
              </ul>
            </div>
          </div>

          {/* Demo */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <SettingsAccordion
              settings={settings}
              onSettingChange={handleSettingChange}
              onSave={handleSaveSettings}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        </section>

        {/* Documentation */}
        <section className="rounded-lg bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Documentation
          </h2>

          {/* Behavior */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Comportement
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                • <strong>Animation :</strong> Ouverture/fermeture fluide avec
                keyframes accordion-down/up (0.2s ease-out)
              </li>
              <li>
                • <strong>Mode single :</strong> Une seule section ouverte à la
                fois (FAQAccordion par défaut)
              </li>
              <li>
                • <strong>Mode multiple :</strong> Plusieurs sections ouvertes
                simultanément (FilterAccordion, SettingsAccordion)
              </li>
              <li>
                • <strong>Keyboard :</strong> Tab (navigation), Enter/Space
                (toggle), ↑↓ (focus sections)
              </li>
              <li>
                • <strong>Accessible :</strong> ARIA labels, focus visible, screen
                reader friendly
              </li>
            </ul>
          </div>

          {/* Configuration */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Configuration
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-900">
                      Props Accordion
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
                    <td className="px-4 py-2 font-mono text-blue-600">type</td>
                    <td className="px-4 py-2 text-gray-600">
                      'single' | 'multiple'
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      Mode d'ouverture des sections
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-blue-600">
                      collapsible
                    </td>
                    <td className="px-4 py-2 text-gray-600">boolean</td>
                    <td className="px-4 py-2 text-gray-700">
                      Permet de fermer toutes les sections
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-blue-600">
                      defaultValue
                    </td>
                    <td className="px-4 py-2 text-gray-600">string[]</td>
                    <td className="px-4 py-2 text-gray-700">
                      Sections ouvertes par défaut
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
                FAQAccordion
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<FAQAccordion
  categories={[
    {
      name: 'Commandes',
      questions: [
        { question: 'Comment ?', answer: 'Réponse...' }
      ]
    }
  ]}
  searchable
  singleMode
/>`}
              </pre>
            </div>

            {/* Example 2 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900">
                FilterAccordion
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<FilterAccordion
  filters={{
    priceRange: { min: 0, max: 500, currentMin: 50, currentMax: 300 },
    brands: [{ id: '1', label: 'Bosch', count: 234 }],
    availability: { inStockOnly: true }
  }}
  onFilterChange={handleChange}
  activeFiltersCount={3}
/>`}
              </pre>
            </div>

            {/* Example 3 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900">
                SettingsAccordion
              </h4>
              <pre className="overflow-x-auto text-xs text-gray-700">
                {`<SettingsAccordion
  settings={{
    account: { firstName: 'Jean', email: '...' },
    notifications: { emailOrders: true },
    security: { twoFactorEnabled: true }
  }}
  onSettingChange={handleChange}
  hasUnsavedChanges={true}
/>`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
