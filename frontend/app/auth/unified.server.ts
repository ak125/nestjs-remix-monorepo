import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";

/**
 * 🔐 SYSTÈME D'AUTHENTIFICATION UNIFIÉ
 * 
 * Combine les meilleures fonctionnalités des deux systèmes précédents :
 * - Support context (pages admin) ET request (pages utilisateur) 
 * - Interface cohérente pour toutes les pages
 * - Gestion d'erreurs robuste
 */

// Interface utilisateur unifiée
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  level?: number;
  isAdmin?: boolean;
  isPro?: boolean;
  isActive?: boolean;
}

const authenticatedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
});

/**
 * Méthode principale pour récupérer un utilisateur (avec context)
 * Utilisée par les pages admin qui ont accès au context
 */
export const getOptionalUser = async ({ context }: { context: AppLoadContext }): Promise<AuthUser | null> => {
  try {
    if (context.user && typeof context.user === 'object' && !(context.user as any).error) {
      const user = authenticatedUserSchema.optional().nullable().parse(context.user);
      if (user) {
        console.log('✅ [Unified Auth] Utilisateur trouvé dans la session via context');
        
        return {
          id: (context.user as any).id,
          email: (context.user as any).email,
          firstName: (context.user as any).firstName,
          lastName: (context.user as any).lastName || (context.user as any).name,
          name: (context.user as any).name,
          level: (context.user as any).level || 1,
          isAdmin: (context.user as any).isAdmin || false,
          isPro: (context.user as any).isPro || false,
          isActive: (context.user as any).isActive !== false
        };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ [Unified Auth] Erreur dans getOptionalUser:', error);
    return null;
  }
};

/**
 * Méthode alternative pour récupérer un utilisateur (avec request)
 * Utilisée par les pages utilisateur qui n'ont que la request
 */
export const getAuthUser = async (request: Request): Promise<AuthUser | null> => {
  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    // Appel à l'endpoint profile avec les cookies de session
    const response = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      },
    });

    if (!response.ok) {
      console.log('❌ [Unified Auth] Profile endpoint error:', response.status);
      return null;
    }

    const userData = await response.json();
    
    if (userData.error || !userData.id) {
      console.log('❌ [Unified Auth] Invalid user data:', userData);
      return null;
    }

    console.log('✅ [Unified Auth] Utilisateur trouvé via API call');
    
    return {
      id: userData.id,
      email: userData.email || userData.cst_mail,
      firstName: userData.firstName || userData.cst_prenom,
      lastName: userData.lastName || userData.cst_nom,
      name: userData.name,
      level: userData.level || (userData.isPro ? 5 : 1),
      isAdmin: userData.isAdmin || false,
      isPro: userData.isPro || false,
      isActive: userData.isActive !== false
    };

  } catch (error) {
    console.error('❌ [Unified Auth] Erreur dans getAuthUser:', error);
    return null;
  }
};

/**
 * 👤 FONCTIONS POUR PAGES UTILISATEUR (account.*)
 */

export const requireUser = async ({ context }: { context: AppLoadContext }): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  if (!user) {
    console.log('❌ [Unified Auth] requireUser: Pas d\'utilisateur connecté');
    throw redirect('/login');
  }
  return user;
};

export const requireAuth = async (request: Request): Promise<AuthUser> => {
  const user = await getAuthUser(request);
  if (!user) {
    console.log('❌ [Unified Auth] requireAuth: Redirection vers login');
    throw redirect('/login?redirect=' + encodeURIComponent(new URL(request.url).pathname));
  }
  return user;
};

export const requireUserWithRedirect = async ({ request, context }: { request: Request, context: AppLoadContext }): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    console.log('❌ [Unified Auth] requireUserWithRedirect: Redirection avec URL');
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  return user;
};

/**
 * 👑 FONCTIONS POUR PAGES ADMIN (admin.*)
 */

export const requireAdmin = async ({ context }: { context: AppLoadContext }): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  
  if (!user) {
    console.log('❌ [Unified Auth] requireAdmin: Pas d\'utilisateur connecté');
    throw redirect('/login');
  }
  
  // Vérifier si c'est un admin (niveau 7+ ou isAdmin)
  const userLevel = user.level || (user.isPro ? 5 : 1);
  if (!user.isAdmin && userLevel < 7) {
    console.log('❌ [Unified Auth] requireAdmin: Utilisateur non admin', { level: userLevel, isAdmin: user.isAdmin });
    throw redirect('/unauthorized');
  }
  
  console.log('✅ [Unified Auth] Admin autorisé', { level: userLevel, isAdmin: user.isAdmin });
  return user;
};

/**
 * 🔄 FONCTIONS UTILITAIRES
 */

export const redirectIfAuthenticated = async ({ context }: { context: AppLoadContext }) => {
  const user = await getOptionalUser({ context });
  if (user) {
    console.log('🔄 [Unified Auth] Utilisateur déjà connecté, redirection vers dashboard');
    throw redirect('/');
  }
  return null;
};

// Export par défaut pour faciliter l'import
export default {
  getOptionalUser,
  getAuthUser,
  requireUser,
  requireAuth,
  requireUserWithRedirect,
  requireAdmin,
  redirectIfAuthenticated
};
