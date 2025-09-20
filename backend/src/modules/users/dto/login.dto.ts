import { z } from 'zod';

export const LoginSchema = z
  .object({
    email: z
      .string()
      .email("L'email doit être valide")
      .min(1, "L'email est obligatoire"),

    password: z.string().min(1, 'Le mot de passe est requis'),
  })
  .strict();

export type LoginDto = z.infer<typeof LoginSchema>;
