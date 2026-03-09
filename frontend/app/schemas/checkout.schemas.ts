/**
 * Checkout Zod schemas — validation server-side (action) + types partages
 *
 * Source de verite unique pour le contrat checkout.
 * Pas de duplication front/back : ce fichier est importe par l'action Remix.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const trimmedString = (label: string, min = 1) =>
  z
    .string({
      required_error: `${label} requis.`,
      invalid_type_error: `${label} invalide.`,
    })
    .trim()
    .min(min, `${label} requis.`);

// ---------------------------------------------------------------------------
// Regex V1
// ---------------------------------------------------------------------------

const frenchZipCodeRegex = /^[0-9]{4,10}$/;
const phoneRegex = /^[0-9+\s().-]{6,20}$/;

// ---------------------------------------------------------------------------
// Shipping address schema
// ---------------------------------------------------------------------------

export const shippingAddressSchema = z.object({
  civility: z.enum(["M.", "Mme", "Societe"], {
    required_error: "Civilite requise.",
    invalid_type_error: "Civilite invalide.",
  }),
  firstName: trimmedString("Prenom", 2).max(100, "Prenom trop long."),
  lastName: trimmedString("Nom", 2).max(100, "Nom trop long."),
  address: trimmedString("Adresse", 5).max(255, "Adresse trop longue."),
  zipCode: z
    .string({ required_error: "Code postal requis." })
    .trim()
    .regex(frenchZipCodeRegex, "Code postal invalide."),
  city: trimmedString("Ville", 2).max(120, "Ville trop longue."),
  country: trimmedString("Pays", 2).max(120, "Pays trop long."),
  phone: z
    .string({ invalid_type_error: "Telephone invalide." })
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || phoneRegex.test(value), {
      message: "Telephone invalide.",
    }),
});

// ---------------------------------------------------------------------------
// Payment method
// ---------------------------------------------------------------------------

export const paymentMethodSchema = z.enum(["card_paybox"], {
  required_error: "Methode de paiement requise.",
  invalid_type_error: "Methode de paiement invalide.",
});

// ---------------------------------------------------------------------------
// Main checkout submit schema (used in action)
// ---------------------------------------------------------------------------

export const checkoutSubmitSchema = shippingAddressSchema.extend({
  guestEmail: z
    .string({ invalid_type_error: "Email invalide." })
    .trim()
    .email("Email invalide.")
    .optional()
    .or(z.literal("")),
  paymentMethod: paymentMethodSchema,
  acceptTerms: z.literal("on", {
    errorMap: () => ({
      message: "Vous devez accepter les conditions generales de vente.",
    }),
  }),
});

// ---------------------------------------------------------------------------
// Error codes metier
// ---------------------------------------------------------------------------

export const checkoutErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "EMPTY_CART",
  "EMAIL_CONFLICT",
  "UNAUTHORIZED",
  "PAYMENT_UNAVAILABLE",
  "ORDER_CREATION_FAILED",
  "UNKNOWN_ERROR",
]);

// ---------------------------------------------------------------------------
// Action response schemas
// ---------------------------------------------------------------------------

export const checkoutActionSuccessSchema = z.object({
  ok: z.literal(true),
  redirectUrl: z.string().min(1),
  orderId: z.string().optional(),
});

export const checkoutFieldErrorsSchema = z
  .object({
    guestEmail: z.array(z.string()).optional(),
    civility: z.array(z.string()).optional(),
    firstName: z.array(z.string()).optional(),
    lastName: z.array(z.string()).optional(),
    address: z.array(z.string()).optional(),
    zipCode: z.array(z.string()).optional(),
    city: z.array(z.string()).optional(),
    country: z.array(z.string()).optional(),
    phone: z.array(z.string()).optional(),
    paymentMethod: z.array(z.string()).optional(),
    acceptTerms: z.array(z.string()).optional(),
  })
  .partial();

export const checkoutActionErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: checkoutErrorCodeSchema.optional(),
  fieldErrors: checkoutFieldErrorsSchema.optional(),
  conflictEmail: z.string().email().optional(),
  emailConflict: z.boolean().optional(),
});

export const checkoutActionResponseSchema = z.union([
  checkoutActionSuccessSchema,
  checkoutActionErrorSchema,
]);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CheckoutSubmitData = z.infer<typeof checkoutSubmitSchema>;
export type ShippingAddressData = z.infer<typeof shippingAddressSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type CheckoutErrorCode = z.infer<typeof checkoutErrorCodeSchema>;
export type CheckoutActionSuccess = z.infer<typeof checkoutActionSuccessSchema>;
export type CheckoutActionError = z.infer<typeof checkoutActionErrorSchema>;
export type CheckoutActionResponse = z.infer<
  typeof checkoutActionResponseSchema
>;
export type CheckoutFieldErrors = z.infer<typeof checkoutFieldErrorsSchema>;

// -- User profile type (replaces Record<string, any>) --

export interface CheckoutUserProfile {
  firstName: string;
  lastName: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
  phone: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// FormData parser helper
// ---------------------------------------------------------------------------

export function parseCheckoutFormData(formData: FormData) {
  const raw = {
    guestEmail: String(formData.get("guestEmail") ?? ""),
    civility: String(formData.get("civility") ?? "M."),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    address: String(formData.get("address") ?? ""),
    zipCode: String(formData.get("zipCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? "France"),
    phone: String(formData.get("phone") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? "card_paybox"),
    acceptTerms: formData.get("acceptTerms"),
  };

  const parsed = checkoutSubmitSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error,
      fieldErrors: parsed.error.flatten().fieldErrors as CheckoutFieldErrors,
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}
