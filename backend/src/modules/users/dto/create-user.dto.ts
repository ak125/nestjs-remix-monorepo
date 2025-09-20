import { z } from 'zod';

// Enum pour la civilité
export const CivilityEnum = z.enum(['M', 'Mme', 'Autre'], {
  message: 'La civilité doit être M, Mme ou Autre',
});

export type Civility = z.infer<typeof CivilityEnum>;

export const CreateUserSchema = z
  .object({
    email: z
      .string()
      .email("L'email doit être valide")
      .min(1, "L'email est obligatoire"),

    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre',
      ),

    firstName: z
      .string()
      .min(1, 'Le prénom est obligatoire')
      .max(50, 'Le prénom ne peut pas dépasser 50 caractères'),

    lastName: z
      .string()
      .min(1, 'Le nom est obligatoire')
      .max(50, 'Le nom ne peut pas dépasser 50 caractères'),

    civility: CivilityEnum.optional(),

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

    isPro: z.boolean().default(false),

    isActive: z.boolean().default(true),

    isNewsletterSubscribed: z.boolean().default(false),

    lastLoginAt: z.date().optional(),
  })
  .strict();

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// Schema pour mise à jour utilisateur
export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  civility: CivilityEnum.optional(),
  isNewsletterSubscribed: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  profileCompleteness: z.number().min(0).max(100).optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
