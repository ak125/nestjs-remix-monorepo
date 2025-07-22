import { z } from 'zod';

export const UpdateUserSchema = z
  .object({
    email: z.string().email("L'email doit être valide").optional(),

    firstName: z
      .string()
      .min(1, 'Le prénom ne peut pas être vide')
      .max(50, 'Le prénom ne peut pas dépasser 50 caractères')
      .optional(),

    lastName: z
      .string()
      .min(1, 'Le nom ne peut pas être vide')
      .max(50, 'Le nom ne peut pas dépasser 50 caractères')
      .optional(),

    tel: z
      .string()
      .regex(/^[+]?[0-9\s\-().]{10,20}$/, 'Format de téléphone invalide')
      .optional(),

    address: z
      .string()
      .min(1, "L'adresse ne peut pas être vide")
      .max(200, "L'adresse ne peut pas dépasser 200 caractères")
      .optional(),

    city: z
      .string()
      .min(1, 'La ville ne peut pas être vide')
      .max(100, 'La ville ne peut pas dépasser 100 caractères')
      .optional(),

    zipCode: z
      .string()
      .regex(/^[0-9]{5}$/, 'Le code postal doit contenir 5 chiffres')
      .optional(),

    country: z
      .string()
      .min(1, 'Le pays ne peut pas être vide')
      .max(100, 'Le pays ne peut pas dépasser 100 caractères')
      .optional(),

    isPro: z.boolean().optional(),

    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
