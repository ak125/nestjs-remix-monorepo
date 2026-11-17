/**
 * Politique de retour — SOURCE UNIQUE, tenue à côté de la politique de port.
 *
 * Lecteurs :
 *   - le frontend, qui reçoit `publicReturnPolicy()` par le port applicatif
 *     (`RemixApplicationPort.getReturnPolicy`) — il ne porte aucune valeur :
 *     bandeau du site et données structurées (`hasMerchantReturnPolicy`) ;
 *   - la page légale « Garantie et Retour » (`___legal_pages`, alias `gcrg`)
 *     reprend le même texte par une migration relue par le département 18.
 *
 * Décision de Marwane du 17 novembre 2026 (22:13 Paris, mandat BJ) : retour
 * possible 30 jours après réception, comme le bandeau ; frais de retour à la
 * charge du client, sauf pièce défectueuse ou erreur de notre part ;
 * remboursement par le moyen de paiement d'origine.
 *
 * Emplacement : sous `backend/src/modules/cart/`, donc sous CODEOWNERS (@ak125).
 * Le schéma est vérifié au chargement du module ET par
 * `return-policy.config.test.ts` en CI.
 */
import { z } from 'zod';

export const ReturnPolicySchema = z
  .object({
    /** Pays où la politique s'applique (ISO 3166-1 alpha-2). */
    country: z.literal('FR'),
    /** Jours, comptés à partir de la réception, pour retourner un produit. */
    returnWindowDays: z.number().int().positive(),
    /**
     * Comment le produit revient : par envoi postal à l'adresse du service
     * retour (procédure de la page `gcrg`, relevée le 17/11/2026).
     */
    returnMethod: z.literal('by_mail'),
    /** Qui paie le retour dans le cas général. */
    returnFeesPaidBy: z.literal('customer'),
    /** Cas où le retour n'est pas à la charge du client. */
    returnFeesWaivedFor: z
      .array(z.enum(['item_defect', 'seller_error']))
      .nonempty(),
    /** Moyen de remboursement. */
    refundMethod: z.literal('original_payment_method'),
  })
  .strict();

export type ReturnPolicy = z.infer<typeof ReturnPolicySchema>;

/** Un schéma invalide arrête le chargement du module : pas de valeur de repli. */
export const RETURN_POLICY: Readonly<ReturnPolicy> = Object.freeze(
  ReturnPolicySchema.parse({
    country: 'FR',
    returnWindowDays: 30,
    returnMethod: 'by_mail',
    returnFeesPaidBy: 'customer',
    returnFeesWaivedFor: ['item_defect', 'seller_error'],
    refundMethod: 'original_payment_method',
  }),
);

/** Ce que le frontend reçoit. */
export interface PublicReturnPolicy {
  country: 'FR';
  returnWindowDays: number;
  returnMethod: 'by_mail';
  returnFeesPaidBy: 'customer';
  returnFeesWaivedFor: Array<'item_defect' | 'seller_error'>;
  refundMethod: 'original_payment_method';
}

export function publicReturnPolicy(): PublicReturnPolicy {
  return {
    country: RETURN_POLICY.country,
    returnWindowDays: RETURN_POLICY.returnWindowDays,
    returnMethod: RETURN_POLICY.returnMethod,
    returnFeesPaidBy: RETURN_POLICY.returnFeesPaidBy,
    returnFeesWaivedFor: [...RETURN_POLICY.returnFeesWaivedFor],
    refundMethod: RETURN_POLICY.refundMethod,
  };
}
