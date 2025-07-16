import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";

const authentictedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
});

export const getOptionalUser = async ({ context }: { context: AppLoadContext }) => {
  try {
    // Vérifier si context.user est valide avant d'essayer de le parser
    if (!context.user || (typeof context.user === 'object' && (context.user as any).error)) {
      return null;
    }
    
    const user = authentictedUserSchema.optional().nullable().parse(context.user);
    if (user) {
      return await context.remixService.getUser({
        userId: user.id 
      });
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