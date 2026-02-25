import { z } from 'zod';

/**
 * Schema Zod pour les callbacks Paybox (IPN - Instant Payment Notification).
 *
 * Paybox envoie les parametres via query string (GET ou POST).
 * Tous les champs sont des strings.
 *
 * Champs standards PBX_RETOUR :
 * - Mt : montant en centimes (ex: "10050" = 100.50 EUR)
 * - Ref : reference commande envoyee dans PBX_CMD
 * - Auto : numero d'autorisation bancaire (vide si echec)
 * - Erreur : code erreur Paybox ("00000" = succes)
 * - Signature / K : signature RSA (base64url)
 *
 * Note: Les noms de parametres dependent de la config PBX_RETOUR du
 * formulaire d'appel. Les variantes ci-dessous couvrent les cas courants.
 */
export const PayboxCallbackSchema = z
  .object({
    // Champs standards PBX_RETOUR
    Mt: z.string().optional(),
    Ref: z.string().optional(),
    Auto: z.string().optional(),
    Erreur: z.string().optional(),
    Signature: z.string().optional(),
    K: z.string().optional(),

    // Variantes avec alias possibles
    amount: z.string().optional(),
    orderReference: z.string().optional(),
    authorization: z.string().optional(),
    errorCode: z.string().optional(),
    signature: z.string().optional(),

    // Identifiants marchands (parfois presents dans le callback)
    PBX_SITE: z.string().optional(),
    PBX_RANG: z.string().optional(),
    PBX_IDENTIFIANT: z.string().optional(),
  })
  .catchall(z.string())
  .refine((data) => !!(data.Ref || data.orderReference), {
    message: 'Reference commande requise (Ref | orderReference)',
  })
  .refine((data) => !!(data.Erreur || data.errorCode), {
    message: 'Code erreur requis (Erreur | errorCode)',
  })
  .refine((data) => !!(data.Signature || data.K || data.signature), {
    message: 'Signature requise (Signature | K | signature)',
  });

/**
 * Type infere du schema Zod
 */
export type PayboxCallbackDto = z.infer<typeof PayboxCallbackSchema>;
