/**
 * 🧪 TEST DROPDOWN MENU - Page de démonstration
 * 
 * Démontre l'utilisation des Dropdown Menus avec :
 * - UserDropdownMenu pour la navigation utilisateur
 * - AdminActionsDropdown pour actions contextuelles
 * - Presets d'actions courantes
 * - Personnalisation et variantes
 */

import { Eye, Plus } from 'lucide-react';
import { useState } from 'react';

import { toast } from 'sonner';

import {
  AdminActionsDropdown,
  adminActionPresets,
} from '../components/admin/AdminActionsDropdown';
import { AdminBreadcrumb } from '../components/admin/AdminBreadcrumb';
import { UserDropdownMenu } from '../components/navbar/UserDropdownMenu';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function TestDropdownMenu() {
  const [actionLog, setActionLog] = useState<string[]>([]);

  const logAction = (action: string) => {
    setActionLog([`${new Date().toLocaleTimeString()} - ${action}`, ...actionLog]);
    toast.success(action);
  };

  // Mock user data
  const mockUser = {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    level: 9,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage="Test Dropdown Menu" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test Dropdown Menu
          </h1>
          <p className="text-gray-600">
            Démonstration des Dropdown Menus Shadcn UI
          </p>
        </div>

        {/* Grid de cartes démo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card 1 : UserDropdownMenu */}
          <Card>
            <CardHeader>
              <CardTitle>👤 UserDropdownMenu</CardTitle>
              <CardDescription>
                Menu utilisateur complet avec profil et actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <span className="text-sm text-gray-600">
                  Menu utilisateur (comme dans la navbar)
                </span>
                <UserDropdownMenu user={mockUser} showName={false} />
              </div>

              <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <span className="text-sm text-gray-600">
                  Avec nom affiché
                </span>
                <UserDropdownMenu user={mockUser} showName={true} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Features:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ Info utilisateur (nom, email)</li>
                  <li>✓ Badge rôle admin</li>
                  <li>✓ Liens vers compte/commandes/favoris</li>
                  <li>✓ Lien admin si niveau ≥ 7</li>
                  <li>✓ Déconnexion intégrée</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 : AdminActionsDropdown - Commande */}
          <Card>
            <CardHeader>
              <CardTitle>📦 Actions Commande</CardTitle>
              <CardDescription>
                Menu d'actions contextuelles pour une commande
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Commande #CMD-12345</p>
                  <p className="text-sm text-gray-500">149.99€ - En attente</p>
                </div>
                <AdminActionsDropdown
                  actions={adminActionPresets.order('12345', {
                    onView: () => logAction('Voir détails commande'),
                    onEdit: () => logAction('Modifier commande'),
                    onPrint: () => logAction('Imprimer commande'),
                    onValidate: () => logAction('Valider commande'),
                    onCancel: () => logAction('Annuler commande'),
                  })}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Actions disponibles:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Voir détails (avec lien)</li>
                  <li>• Modifier / Imprimer</li>
                  <li className="text-green-600">• Valider (success)</li>
                  <li className="text-red-600">• Annuler (destructive)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 : AdminActionsDropdown - Produit */}
          <Card>
            <CardHeader>
              <CardTitle>🛍️ Actions Produit</CardTitle>
              <CardDescription>
                Menu d'actions pour gérer un produit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Plaquettes de frein</p>
                  <p className="text-sm text-gray-500">SKU: BRK-2024-001</p>
                </div>
                <AdminActionsDropdown
                  actions={adminActionPresets.product('2024-001', {
                    onEdit: () => logAction('Modifier produit'),
                    onDuplicate: () => logAction('Dupliquer produit'),
                    onDelete: () => logAction('Supprimer produit'),
                  })}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Actions disponibles:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Voir la fiche produit</li>
                  <li>• Modifier / Dupliquer</li>
                  <li className="text-red-600">• Supprimer (destructive)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 : AdminActionsDropdown - Utilisateur */}
          <Card>
            <CardHeader>
              <CardTitle>👥 Actions Utilisateur</CardTitle>
              <CardDescription>
                Menu d'actions pour gérer un utilisateur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Marie Martin</p>
                  <p className="text-sm text-gray-500">marie.martin@example.com</p>
                </div>
                <AdminActionsDropdown
                  actions={adminActionPresets.user('user-456', {
                    onEdit: () => logAction('Modifier utilisateur'),
                    onSendEmail: () => logAction('Envoyer email'),
                    onBlock: () => logAction('Bloquer utilisateur'),
                    onDelete: () => logAction('Supprimer utilisateur'),
                  })}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Actions disponibles:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Voir le profil</li>
                  <li>• Modifier / Envoyer email</li>
                  <li className="text-yellow-600">• Bloquer (warning)</li>
                  <li className="text-red-600">• Supprimer (destructive)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Card 5 : Action Log */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Journal des actions
              </CardTitle>
              <CardDescription>
                Les actions cliquées apparaissent ici en temps réel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                {actionLog.length === 0 ? (
                  <p className="text-gray-500">Aucune action pour le moment...</p>
                ) : (
                  actionLog.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
              {actionLog.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionLog([])}
                  className="mt-4"
                >
                  Vider le journal
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card 6 : Avantages */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                Avantages Shadcn Dropdown Menu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Accessibilité</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Support clavier complet (↑↓ Enter Esc)</li>
                    <li>✓ ARIA labels automatiques</li>
                    <li>✓ Focus trap et navigation logique</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">UX</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Animations fluides natives</li>
                    <li>✓ Positionnement intelligent</li>
                    <li>✓ Fermeture automatique</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Développeur</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ API composable et flexible</li>
                    <li>✓ TypeScript full support</li>
                    <li>✓ Presets réutilisables</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Design</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Variantes de couleurs</li>
                    <li>✓ Icônes intégrées</li>
                    <li>✓ Raccourcis clavier affichés</li>
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
