/**
 * 🔐 SYSTÈME DE PERMISSIONS UNIFIÉ
 * Gère les permissions selon le niveau utilisateur
 */

export interface UserPermissions {
  // Actions sur les commandes
  canValidate: boolean;        // Valider commande (2→3)
  canShip: boolean;            // Expédier (3→4)
  canDeliver: boolean;         // Marquer livrée (4→5)
  canCancel: boolean;          // Annuler commande
  canReturn: boolean;          // Gérer retours/SAV
  canRefund: boolean;          // Émettre remboursements
  canSendEmails: boolean;      // Envoyer emails clients
  
  // Gestion
  canCreateOrders: boolean;    // Créer nouvelle commande
  canExport: boolean;          // Export CSV
  canMarkPaid: boolean;        // Marquer payé
  
  // Affichage
  canSeeFullStats: boolean;    // Stats complètes (6 cartes)
  canSeeFinancials: boolean;   // Montants impayés, CA détaillé
  canSeeCustomerDetails: boolean; // Infos client complètes
  
  // Interface
  showAdvancedFilters: boolean; // Filtres avancés
  showActionButtons: boolean;   // Boutons d'action
}

/**
 * Détermine les permissions selon le niveau utilisateur
 * @param userLevel - Niveau de l'utilisateur (0-9)
 * @returns Objet de permissions
 */
export function getUserPermissions(userLevel: number): UserPermissions {
  // Super Admin (niveau 9)
  if (userLevel >= 9) {
    return {
      canValidate: true,
      canShip: true,
      canDeliver: true,
      canCancel: true,
      canReturn: true,
      canRefund: true,
      canSendEmails: true,
      canCreateOrders: true,
      canExport: true,
      canMarkPaid: true,
      canSeeFullStats: true,
      canSeeFinancials: true,
      canSeeCustomerDetails: true,
      showAdvancedFilters: true,
      showActionButtons: true,
    };
  }
  
  // Admin (niveau 7-8)
  if (userLevel >= 7) {
    return {
      canValidate: true,
      canShip: true,
      canDeliver: true,
      canCancel: true,
      canReturn: true,           // ✅ Admin peut gérer retours
      canRefund: true,           // ✅ Admin peut rembourser
      canSendEmails: true,
      canCreateOrders: true,
      canExport: true,
      canMarkPaid: true,
      canSeeFullStats: true,
      canSeeFinancials: true,
      canSeeCustomerDetails: true,
      showAdvancedFilters: true,
      showActionButtons: true,
    };
  }
  
  // Manager / Responsable (niveau 5-6)
  if (userLevel >= 5) {
    return {
      canValidate: false,
      canShip: false,
      canDeliver: false,
      canCancel: false,
      canReturn: false,          // ❌ Pas de gestion retours
      canRefund: false,          // ❌ Pas de remboursements
      canSendEmails: false,
      canCreateOrders: false,
      canExport: true,
      canMarkPaid: false,
      canSeeFullStats: true,         // Peut voir stats complètes
      canSeeFinancials: true,        // Peut voir finances
      canSeeCustomerDetails: true,
      showAdvancedFilters: true,
      showActionButtons: false,
    };
  }
  
  // Commercial (niveau 3-4)
  if (userLevel >= 3) {
    return {
      canValidate: true,             // ✅ Peut valider commandes
      canShip: true,                 // ✅ Peut expédier
      canDeliver: true,              // ✅ Peut marquer livrée
      canCancel: true,               // ✅ Peut annuler
      canReturn: false,              // ❌ Pas de gestion retours (réservé Admin)
      canRefund: false,              // ❌ Pas de remboursements (réservé Admin)
      canSendEmails: true,           // ✅ Peut envoyer emails clients
      canCreateOrders: false,        // ❌ NE PEUT PAS créer de commandes
      canExport: true,               // ✅ Peut exporter
      canMarkPaid: true,             // ✅ Peut marquer payé
      canSeeFullStats: false,        // ❌ PAS de statistiques
      canSeeFinancials: false,       // ❌ PAS de montants financiers
      canSeeCustomerDetails: true,   // ✅ Peut voir infos clients
      showAdvancedFilters: true,     // ✅ Filtres avancés (pour gérer commandes)
      showActionButtons: true,       // ✅ Boutons d'action visibles
    };
  }
  
  // Utilisateur de base (niveau 1-2) - Pas d'accès
  return {
    canValidate: false,
    canShip: false,
    canDeliver: false,
    canCancel: false,
    canReturn: false,
    canRefund: false,
    canSendEmails: false,
    canCreateOrders: false,
    canExport: false,
    canMarkPaid: false,
    canSeeFullStats: false,
    canSeeFinancials: false,
    canSeeCustomerDetails: false,
    showAdvancedFilters: false,
    showActionButtons: false,
  };
}

/**
 * Vérifie si l'utilisateur peut effectuer une action spécifique
 * @param permissions - Objet de permissions
 * @param action - Action à vérifier
 * @returns true si autorisé
 */
export function canPerformAction(
  permissions: UserPermissions,
  action: keyof UserPermissions
): boolean {
  return permissions[action] === true;
}

/**
 * Retourne le rôle affiché selon le niveau
 */
export function getUserRole(userLevel: number): {
  label: string;
  badge: string;
  color: string;
  bgColor: string;
} {
  if (userLevel >= 9) {
    return {
      label: 'Super Admin',
      badge: '👑',
      color: 'text-purple-800',
      bgColor: 'bg-purple-100',
    };
  }
  
  if (userLevel >= 7) {
    return {
      label: 'Administrateur',
      badge: '🔑',
      color: 'text-blue-800',
      bgColor: 'bg-blue-100',
    };
  }
  
  if (userLevel >= 5) {
    return {
      label: 'Responsable',
      badge: '📊',
      color: 'text-green-800',
      bgColor: 'bg-green-100',
    };
  }
  
  if (userLevel >= 3) {
    return {
      label: 'Commercial',
      badge: '👔',
      color: 'text-indigo-800',
      bgColor: 'bg-indigo-100',
    };
  }
  
  return {
    label: 'Utilisateur',
    badge: '👤',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  };
}
