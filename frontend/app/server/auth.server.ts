import { AppLoadContext, redirect } from "@remix-run/node";
import { z } from "zod";

const authentictadUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string(),
});


export const getOptionalUser =async ({ context }:{ context: AppLoadContext }) => {
  const user = authentictadUserSchema.optional().nullable().parse(context.user);
  if (user) {
    return await context.remixService.getUser({
      userId: user.id 
    });
  }
  return null;
}

export const requireUser =async ({ context }:{ context: AppLoadContext }) => {
  const user = await getOptionalUser({ context })
  if (!user) {
    throw redirect('/login');
  }
  return user;
}