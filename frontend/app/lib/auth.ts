/**
 * Utilitaires pour la gestion des rôles et permissions
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  isPro?: boolean;
}

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  PRO: 'pro'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Vérifie si l'utilisateur est administrateur
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === USER_ROLES.ADMIN || user?.isPro === true;
}

/**
 * Vérifie si l'utilisateur est un utilisateur normal
 */
export function isRegularUser(user: User | null): boolean {
  return user !== null && !isAdmin(user);
}

/**
 * Vérifie si l'utilisateur a accès aux fonctionnalités admin
 */
export function hasAdminAccess(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Vérifie si l'utilisateur peut voir toutes les commandes
 */
export function canViewAllOrders(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Vérifie si l'utilisateur peut modifier une commande
 */
export function canEditOrder(user: User | null, orderUserId?: string): boolean {
  if (isAdmin(user)) return true;
  return user?.id === orderUserId;
}

/**
 * Vérifie si l'utilisateur peut créer des commandes
 */
export function canCreateOrder(user: User | null): boolean {
  return user !== null;
}

/**
 * Obtient l'URL de redirection par défaut selon le rôle
 */
export function getDefaultRedirectUrl(user: User | null): string {
  if (isAdmin(user)) {
    return '/admin/orders';
  }
  return '/my-orders';
}

/**
 * Obtient les routes autorisées pour un utilisateur
 */
export function getAuthorizedRoutes(user: User | null): string[] {
  const baseRoutes = ['/'];
  
  if (!user) {
    return [...baseRoutes, '/login', '/register'];
  }
  
  const userRoutes = [
    ...baseRoutes,
    '/my-orders',
    '/orders/new',
    '/profile',
    '/logout'
  ];
  
  if (isAdmin(user)) {
    return [
      ...userRoutes,
      '/admin/orders',
      '/admin/customers',
      '/admin/reports',
      '/orders' // Accès aux anciennes routes pour compatibilité
    ];
  }
  
  return userRoutes;
}

/**
 * Middleware pour vérifier les permissions d'accès
 */
export function checkRoutePermission(
  route: string, 
  user: User | null
): { allowed: boolean; redirectTo?: string } {
  const authorizedRoutes = getAuthorizedRoutes(user);
  
  // Routes publiques
  if (['/login', '/register', '/'].includes(route)) {
    return { allowed: true };
  }
  
  // Utilisateur non connecté
  if (!user) {
    return { allowed: false, redirectTo: '/login' };
  }
  
  // Routes admin
  if (route.startsWith('/admin/')) {
    if (!isAdmin(user)) {
      return { allowed: false, redirectTo: '/my-orders' };
    }
    return { allowed: true };
  }
  
  // Routes utilisateur
  if (route.startsWith('/my-orders') || route.startsWith('/orders/new')) {
    return { allowed: true };
  }
  
  // Anciennes routes /orders - redirection selon le rôle
  if (route.startsWith('/orders') && route !== '/orders/new') {
    if (isAdmin(user)) {
      return { allowed: true, redirectTo: '/admin/orders' };
    } else {
      return { allowed: true, redirectTo: '/my-orders' };
    }
  }
  
  // Vérification générale
  if (authorizedRoutes.some(authRoute => route.startsWith(authRoute))) {
    return { allowed: true };
  }
  
  return { allowed: false, redirectTo: getDefaultRedirectUrl(user) };
}
