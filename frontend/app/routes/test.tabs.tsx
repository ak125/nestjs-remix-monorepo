/**
 * 🧪 TEST TABS - Page de démonstration Shadcn Tabs
 * 
 * Démontre l'utilisation des Tabs avec :
 * - ProductTabs pour fiche produit
 * - Admin Tabs pour configuration
 * - Settings Tabs pour paramètres utilisateur
 * - Vertical Tabs
 */

import { useState } from 'react';

import {
  Bell,
  CreditCard,
  Lock,
  Settings,
  User,
} from 'lucide-react';

import { AdminBreadcrumb } from '../components/admin/AdminBreadcrumb';
import { ProductTabs } from '../components/products/ProductTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export default function TestTabs() {
  const [settingsTab, setSettingsTab] = useState('profile');

  // Mock product data
  const mockProduct = {
    description: `
      <p>Plaquettes de frein haute performance pour voiture. Conçues pour offrir une excellente puissance de freinage et une durabilité maximale.</p>
      <ul>
        <li>Performance optimale dans toutes les conditions</li>
        <li>Faible usure des disques</li>
        <li>Réduction des bruits de freinage</li>
        <li>Homologation européenne ECE R90</li>
      </ul>
    `,
    specifications: {
      'Marque': 'Brembo',
      'Référence': 'P85073',
      'Matériau': 'Céramique',
      'Largeur': '140 mm',
      'Hauteur': '58 mm',
      'Épaisseur': '18 mm',
      'Poids': '1.2 kg',
      'Température max': '650°C',
    },
    reviews: [
      {
        id: '1',
        author: 'Jean Dupont',
        rating: 5,
        comment: 'Excellentes plaquettes ! Freinage progressif et silencieux. Je recommande.',
        date: '15/10/2024',
      },
      {
        id: '2',
        author: 'Marie Martin',
        rating: 4,
        comment: 'Très bon produit, installation facile. Léger bruit au début mais disparaît après rodage.',
        date: '02/10/2024',
      },
      {
        id: '3',
        author: 'Pierre Durand',
        rating: 5,
        comment: 'Top qualité ! Nette amélioration par rapport aux plaquettes d\'origine.',
        date: '28/09/2024',
      },
    ],
    installationGuide: `
      <h4>Étapes d'installation</h4>
      <ol>
        <li>Lever le véhicule et retirer la roue</li>
        <li>Retirer les anciennes plaquettes</li>
        <li>Nettoyer l'étrier avec du nettoyant frein</li>
        <li>Vérifier l'état des disques</li>
        <li>Installer les nouvelles plaquettes</li>
        <li>Remonter la roue et effectuer un rodage sur 200 km</li>
      </ol>
      <p><strong>⚠️ Attention :</strong> Si vous n'êtes pas sûr, faites appel à un professionnel.</p>
    `,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage="Test Tabs" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Shadcn Tabs
          </h1>
          <p className="text-gray-600">
            Démonstration des Tabs pour organisation de contenu
          </p>
        </div>

        {/* Grid de cartes démo */}
        <div className="space-y-8">
          
          {/* Card 1 : ProductTabs */}
          <Card>
            <CardHeader>
              <CardTitle>🛍️ ProductTabs - Fiche produit</CardTitle>
              <CardDescription>
                Onglets pour organiser les informations produit (description, specs, avis)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductTabs
                description={mockProduct.description}
                specifications={mockProduct.specifications}
                reviews={mockProduct.reviews}
                installationGuide={mockProduct.installationGuide}
                defaultTab="description"
              />
            </CardContent>
          </Card>

          {/* Card 2 : Settings Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Settings Tabs - Paramètres utilisateur</CardTitle>
              <CardDescription>
                Onglets pour organiser les paramètres (profil, sécurité, notifications)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={settingsTab} onValueChange={setSettingsTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profil
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Sécurité
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Notifications
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Facturation
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Informations du profil</h3>
                    <p className="text-gray-600">
                      Gérez vos informations personnelles et votre photo de profil.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Formulaire de profil ici...</p>
                  </div>
                </TabsContent>

                <TabsContent value="security" className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Sécurité du compte</h3>
                    <p className="text-gray-600">
                      Configurez votre mot de passe et l'authentification à deux facteurs.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Options de sécurité ici...</p>
                  </div>
                </TabsContent>

                <TabsContent value="notifications" className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Préférences de notification</h3>
                    <p className="text-gray-600">
                      Choisissez comment et quand vous souhaitez être notifié.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Paramètres de notifications ici...</p>
                  </div>
                </TabsContent>

                <TabsContent value="billing" className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Facturation et paiement</h3>
                    <p className="text-gray-600">
                      Gérez vos moyens de paiement et consultez vos factures.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Informations de facturation ici...</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Card 3 : Admin Dashboard Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Admin Dashboard Tabs</CardTitle>
              <CardDescription>
                Onglets pour tableau de bord admin (vue générale, statistiques, logs)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                  <TabsTrigger value="stats">Statistiques</TabsTrigger>
                  <TabsTrigger value="logs">Logs système</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <p className="text-sm text-blue-600 font-medium">Commandes</p>
                      <p className="text-3xl font-bold text-blue-900 mt-2">1,234</p>
                      <p className="text-xs text-blue-600 mt-1">+12% ce mois</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <p className="text-sm text-green-600 font-medium">Revenus</p>
                      <p className="text-3xl font-bold text-green-900 mt-2">45,678€</p>
                      <p className="text-xs text-green-600 mt-1">+8% ce mois</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                      <p className="text-sm text-purple-600 font-medium">Utilisateurs</p>
                      <p className="text-3xl font-bold text-purple-900 mt-2">8,912</p>
                      <p className="text-xs text-purple-600 mt-1">+24% ce mois</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="mt-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <p className="text-gray-600">Graphiques et statistiques détaillées...</p>
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="mt-6">
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs">
                    <div>[2024-11-05 20:30:15] INFO: Server started on port 3000</div>
                    <div>[2024-11-05 20:30:16] INFO: Database connected</div>
                    <div>[2024-11-05 20:30:17] INFO: All services initialized</div>
                    <div>[2024-11-05 20:30:18] DEBUG: Cache warmed up</div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Card 4 : Avantages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-green-600" />
                Avantages Shadcn Tabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Navigation</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Support clavier (Tab, flèches)</li>
                    <li>✓ Navigation fluide sans rechargement</li>
                    <li>✓ État persistant automatique</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">UX</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Réduction du scroll</li>
                    <li>✓ Organisation claire du contenu</li>
                    <li>✓ Chargement lazy des onglets</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Accessibilité</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ ARIA roles automatiques</li>
                    <li>✓ Focus management</li>
                    <li>✓ Screen reader friendly</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Design</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Personnalisation facile</li>
                    <li>✓ Icônes et badges intégrés</li>
                    <li>✓ Responsive mobile/desktop</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
