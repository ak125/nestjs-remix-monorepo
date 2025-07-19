import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  tel: z.string().optional(),
  isPro: z.boolean(),
  isActive: z.boolean(),
  level: z.number().min(0).max(9).default(2), // Niveaux d'autorisation du legacy
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  
  // Adresses (relations)
  billingAddress: z.any().optional(), // UserAddressDto
  deliveryAddress: z.any().optional(), // UserAddressDto
  
  // Statistiques utilisateur
  totalOrders: z.number().default(0),
  totalSpent: z.number().default(0),
  lastLoginAt: z.date().optional(),
  
  // Préférences
  newsletter: z.boolean().default(false),
  smsNotifications: z.boolean().default(false),
  
}).strict();

export type UserProfileDto = z.infer<typeof UserProfileSchema>;

// Helper pour transformer les données avec les adresses
export function transformUserToProfile(user: any, addresses?: any[]): UserProfileDto {
  const billingAddress = addresses?.find(addr => addr.type === 'billing');
  const deliveryAddress = addresses?.find(addr => addr.type === 'delivery');
  
  return {
    id: user.cst_id,
    email: user.cst_mail,
    firstName: user.cst_fname,
    lastName: user.cst_name,
    tel: user.cst_tel,
    isPro: user.cst_is_pro === '1' || user.cst_is_pro === true,
    isActive: user.cst_activ === '1' || user.cst_activ === true,
    level: parseInt(user.cst_level || '2', 10),
    createdAt: user.cst_date_add ? new Date(user.cst_date_add) : undefined,
    updatedAt: user.cst_date_upd ? new Date(user.cst_date_upd) : undefined,
    billingAddress,
    deliveryAddress,
    totalOrders: user.total_orders || 0,
    totalSpent: parseFloat(user.total_spent || '0'),
    lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
    newsletter: user.newsletter === '1' || user.newsletter === true,
    smsNotifications: user.sms_notifications === '1' || user.sms_notifications === true,
  };
}
