import { z } from 'zod';

/**
 * ✅ Schema Zod pour l'inscription utilisateur
 * Cohérent avec l'architecture existante (Zod déjà utilisé dans le projet)
 * 
 * Validation stricte pour sécurité production (59k+ utilisateurs)
 */
export const RegisterSchema = z.object({
  email: z
    .string({ required_error: 'Email requis' })
    .email({ message: 'Format email invalide' })
    .toLowerCase()
    .trim()
    .max(255, 'Email trop long'),

  password: z
    .string({ required_error: 'Mot de passe requis' })
    .min(8, { message: 'Minimum 8 caractères' })
    .max(100, 'Mot de passe trop long')
    .regex(/[A-Z]/, 'Au moins une majuscule requise')
    .regex(/[a-z]/, 'Au moins une minuscule requise')
    .regex(/[0-9]/, 'Au moins un chiffre requis')
    .regex(
      /[^A-Za-z0-9]/,
      'Au moins un caractère spécial requis (!@#$%^&*...)',
    ),

  firstName: z
    .string()
    .min(2, 'Prénom minimum 2 caractères')
    .max(50, 'Prénom trop long')
    .trim()
    .optional(),

  lastName: z
    .string()
    .min(2, 'Nom minimum 2 caractères')
    .max(50, 'Nom trop long')
    .trim()
    .optional(),

  // Champs optionnels pour correspondre au schéma DB
  civility: z.enum(['M', 'Mme', 'Mlle']).optional(),
  
  tel: z
    .string()
    .regex(/^[\d\s\+\-\(\)]+$/, 'Numéro de téléphone invalide')
    .optional(),
  
  gsm: z
    .string()
    .regex(/^[\d\s\+\-\(\)]+$/, 'Numéro de mobile invalide')
    .optional(),
});

/**
 * ✅ Type TypeScript inféré automatiquement du schema Zod
 * Garantit la cohérence entre validation et typage
 */
export type RegisterDto = z.infer<typeof RegisterSchema>;

/**
 * ✅ Helper pour validation manuelle si nécessaire
 */
export const validateRegister = (data: unknown): RegisterDto => {
  return RegisterSchema.parse(data);
};

/**
 * ✅ Export par défaut du schema pour usage avec ZodValidationPipe
 * Usage: @Body(new ZodValidationPipe(RegisterSchema)) userData: RegisterDto
 */
export default RegisterSchema;
