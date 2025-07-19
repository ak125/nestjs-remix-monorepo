import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";
import { mockUser } from "~/utils/simple-auth";

const authentictedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
});

export const getOptionalUser = async ({ context }: { context: AppLoadContext }) => {
  try {
    // Mode développement : retourner l'utilisateur mock pour les tests admin
    if (process.env.NODE_ENV === 'development') {
      return mockUser;
    }

    // Vérifier si context.user est valide avant d'essayer de le parser
    if (!context.user || (typeof context.user === 'object' && (context.user as any).error)) {
      return null;
    }
    
    const user = authentictedUserSchema.optional().nullable().parse(context.user);
    if (user) {
      try {
        return await context.remixService.getUser({
          userId: user.id 
        });
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        return null;
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