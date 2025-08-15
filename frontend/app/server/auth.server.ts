import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";

// Type pour l'utilisateur
export interface User {
  id: string;
  email: string;
  firstName?: string;
  name?: string;
  level?: number;
  isAdmin?: boolean;
  isPro?: boolean;
}

const authentictedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
});

export const getOptionalUser = async ({ context }: { context: AppLoadContext }) => {
  try {
    // Vérifier s'il y a une session utilisateur active
    if (context.user && typeof context.user === 'object' && !(context.user as any).error) {
      const user = authentictedUserSchema.optional().nullable().parse(context.user);
      if (user) {
        console.log('✅ Utilisateur trouvé dans la session, utilisation directe');
        
        // Utiliser directement les données de session pour tous les utilisateurs
        return {
          id: (context.user as any).id,
          email: (context.user as any).email,
          firstName: (context.user as any).firstName,
          lastName: (context.user as any).lastName || (context.user as any).name,
          level: (context.user as any).level || 1,
          isAdmin: (context.user as any).isAdmin || false,
          isPro: (context.user as any).isPro || false,
          isActive: (context.user as any).isActive !== false
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erreur dans getOptionalUser:', error);
    return null;
  }
}

export const requireUser = async ({ context }: { context: AppLoadContext }) => {
  const user = await getOptionalUser({ context })
  if (!user) {
    throw redirect('/login');
  }
  return user;
}

export const requireUserWithRedirect = async ({ request, context }: { request: Request, context: AppLoadContext }) => {
  const user = await getOptionalUser({ context })
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

export const redirectIfAuthenticated = async ({ context }: { context: AppLoadContext }) => {
  const user = await getOptionalUser({ context })
  if (user) {
    throw redirect('/');
  }
  return null;
}

export async function requireAdmin({ context }: { context: AppLoadContext }): Promise<User> {
  const user = await getOptionalUser({ context });
  
  if (!user) {
    console.log('❌ requireAdmin: Pas d\'utilisateur connecté');
    throw redirect('/login');
  }
  
  // Vérifier si c'est un admin (niveau 7+ ou isAdmin)
  const userLevel = user.level || (user.isPro ? 5 : 1);
  if (!user.isAdmin && userLevel < 7) {
    console.log('❌ requireAdmin: Utilisateur non admin');
    throw redirect('/unauthorized');
  }
  
  return user;
}