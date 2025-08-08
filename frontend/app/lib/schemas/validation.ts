import { z } from 'zod';

// Schémas pour la validation des formulaires admin
export const LoginFormSchema = z.object({
  email: z.string()
    .email('Email invalide')
    .min(1, 'Email requis'),
  password: z.string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .min(1, 'Mot de passe requis'),
});

export const OrderSearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const CustomerSearchSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['individual', 'business']).optional(),
  active: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const ProductFormSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  price: z.number().min(0, 'Prix doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  stock: z.number().min(0, 'Stock doit être positif'),
  active: z.boolean().default(true),
});

export const SupplierFormSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  active: z.boolean().default(true),
});

// Types TypeScript dérivés des schémas
export type LoginFormData = z.infer<typeof LoginFormSchema>;
export type OrderSearchData = z.infer<typeof OrderSearchSchema>;
export type CustomerSearchData = z.infer<typeof CustomerSearchSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;
export type SupplierFormData = z.infer<typeof SupplierFormSchema>;

// Hook pour la validation de formulaires avec Zod
export const useZodValidation = <T extends z.ZodSchema>(schema: T) => {
  const validate = (data: unknown): { success: boolean; data?: z.infer<T>; errors?: Record<string, string> } => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((error) => {
        if (error.path.length > 0) {
          errors[error.path[0] as string] = error.message;
        }
      });
      return { success: false, errors };
    }
  };

  return { validate };
};
