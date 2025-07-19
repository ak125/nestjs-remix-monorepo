import { z } from 'zod';

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  tel: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  isPro: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).strict();

export type UserResponseDto = z.infer<typeof UserResponseSchema>;

// Helper pour transformer les données de la DB vers le DTO
export function transformUserToResponse(user: any): UserResponseDto {
  return {
    id: user.cst_id,
    email: user.cst_mail,
    firstName: user.cst_fname,
    lastName: user.cst_name,
    tel: user.cst_tel,
    address: user.cst_address,
    city: user.cst_city,
    zipCode: user.cst_zip_code,
    country: user.cst_country,
    isPro: user.cst_is_pro === '1' || user.cst_is_pro === true,
    isActive: user.cst_activ === '1' || user.cst_activ === true,
    createdAt: user.cst_date_add ? new Date(user.cst_date_add) : undefined,
    updatedAt: user.cst_date_upd ? new Date(user.cst_date_upd) : undefined,
  };
}