import { z } from 'zod';

/**
 * 🎯 DTOs pour les CLIENTS du site (table ___xtr_customer)
 *
 * IMPORTANT: Clients = Acheteurs du site (pas le personnel admin)
 */

// Schema de base pour un client
export const CustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civility: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().default('FR'),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPro: z.boolean().default(false),
  isCompany: z.boolean().default(false),
  level: z.number().min(1).max(5).default(1), // 1-5 pour clients
  isActive: z.boolean().default(true),
  siret: z.string().optional(),
  companyName: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Schema pour créer un nouveau client
export const CreateCustomerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civility: z.enum(['M', 'Mme', 'Autre']).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPro: z.boolean().default(false),
  isCompany: z.boolean().default(false),
  companyName: z.string().optional(),
  siret: z.string().optional(),
});

// Schema pour mettre à jour un client
export const UpdateCustomerSchema = CustomerSchema.partial().omit({ id: true });

// Schema pour les filtres de recherche
export const CustomerFiltersSchema = z.object({
  search: z.string().optional(),
  level: z.number().min(1).max(5).optional(),
  isPro: z.boolean().optional(),
  isActive: z.boolean().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Types exportés
export type Customer = z.infer<typeof CustomerSchema>;
export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;
export type CustomerFilters = z.infer<typeof CustomerFiltersSchema>;

// Response paginée
export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
