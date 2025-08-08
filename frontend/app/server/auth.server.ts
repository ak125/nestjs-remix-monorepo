import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";

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
        // ✅ Si c'est un admin (ID commence par test_admin_ ou level >= 7), utiliser directement les données de session
        if ((context.user as any).isAdmin || 
            (context.user as any).level >= 7 || 
            user.id.includes('admin') ||
            user.id.startsWith('test_admin_')) {
          console.log('🔧 Admin détecté - Utilisation directe des données de session');
          return {
            id: (context.user as any).id,
            email: (context.user as any).email,
            firstName: (context.user as any).firstName,
            name: (context.user as any).lastName || (context.user as any).name,
            level: (context.user as any).level,
            isAdmin: (context.user as any).isAdmin
          };
        }

        // Pour les utilisateurs normaux, essayer de les récupérer en base
        try {
          const dbUser = await context.remixService.getUser({
            userId: user.id 
          });
          return dbUser;
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'utilisateur normal:', error);
          
          // Fallback vers les données de session si l'utilisateur est authentifié
          if (context.user) {
            console.log('🔧 Fallback: Utilisation des données de session pour utilisateur authentifié');
            return {
              id: (context.user as any).id,
              email: (context.user as any).email,
              firstName: (context.user as any).firstName,
              name: (context.user as any).lastName || (context.user as any).name,
              level: (context.user as any).level || 1,
              isAdmin: (context.user as any).isAdmin || false
            };
          }
          
          return null;
        }
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