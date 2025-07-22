import { z } from 'zod';

export const UserAddressSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string(),
    type: z.enum(['billing', 'delivery'], {
      message: 'Le type d\'adresse doit être "billing" ou "delivery"',
    }),
    firstName: z
      .string()
      .min(1, 'Le prénom est obligatoire')
      .max(50, 'Le prénom ne peut pas dépasser 50 caractères'),

    lastName: z
      .string()
      .min(1, 'Le nom est obligatoire')
      .max(50, 'Le nom ne peut pas dépasser 50 caractères'),

    company: z
      .string()
      .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères")
      .optional(),

    address: z
      .string()
      .min(1, "L'adresse est obligatoire")
      .max(200, "L'adresse ne peut pas dépasser 200 caractères"),

    addressComplement: z
      .string()
      .max(200, "Le complément d'adresse ne peut pas dépasser 200 caractères")
      .optional(),

    city: z
      .string()
      .min(1, 'La ville est obligatoire')
      .max(100, 'La ville ne peut pas dépasser 100 caractères'),

    zipCode: z
      .string()
      .regex(/^[0-9]{5}$/, 'Le code postal doit contenir 5 chiffres'),

    country: z
      .string()
      .min(1, 'Le pays est obligatoire')
      .max(100, 'Le pays ne peut pas dépasser 100 caractères')
      .default('France'),

    isDefault: z.boolean().default(false),
  })
  .strict();

export const CreateUserAddressSchema = UserAddressSchema.omit({ id: true });
export const UpdateUserAddressSchema = UserAddressSchema.partial().omit({
  userId: true,
});

export type UserAddressDto = z.infer<typeof UserAddressSchema>;
export type CreateUserAddressDto = z.infer<typeof CreateUserAddressSchema>;
export type UpdateUserAddressDto = z.infer<typeof UpdateUserAddressSchema>;
