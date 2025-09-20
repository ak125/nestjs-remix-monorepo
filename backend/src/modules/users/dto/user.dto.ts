import { z } from 'zod';

// Schema pour utilisateur
export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  civility: z.enum(['M', 'Mme', 'Mlle']).optional(),
  dateOfBirth: z.string().optional(),
  isNewsletterSubscribed: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
