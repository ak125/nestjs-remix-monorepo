/**
 * Politique des frais de port — SOURCE UNIQUE du forfait et du seuil de gratuité.
 *
 * Tout ce qui calcule, affiche ou écrit un montant de port ou un seuil de
 * gratuité lit ce fichier :
 *   - le calcul (`ShippingCalculatorService`, donc panier et commande) ;
 *   - le frontend, qui reçoit `publicShippingPolicy()` par le port applicatif
 *     (`RemixApplicationPort.getShippingPolicy`) — il ne porte aucune valeur ;
 *   - les consignes de rédaction (contenu, posts sociaux, règles de marque), par
 *     `freeShippingWording()`.
 *
 * Décisions : décision 75 (frais de port affichés avant paiement, grille tenue en
 * configuration, gratuité au-dessus d'un montant fixé par Marwane) ; décision de
 * Marwane du 17 novembre 2026 (mandat BJ) : forfait unique de 9,90 € TTC en France
 * métropolitaine quel que soit le poids, port offert dès 100 € TTC.
 *
 * Emplacement : sous `backend/src/modules/cart/`, donc sous CODEOWNERS (@ak125) —
 * changer un prix de port passe par le circuit élevé. Le schéma ci-dessous est
 * vérifié au chargement du module ET par `shipping-policy.config.test.ts` en CI.
 *
 * Corse et DOM-TOM : la grille au poids (`___xtr_delivery_ape_corse`, `_domtom1`,
 * `_domtom2`) reste l'autorité du montant. Les deux valeurs tenues ici pour ces
 * zones sont celles que le code appliquait déjà avant le mandat BJ (gratuité à
 * 150 € TTC, repli à 15,90 € si la grille est illisible) : elles sont relevées,
 * pas décidées — voir le rapport du mandat BJ.
 */
import { z } from 'zod';

export type ShippingZone = 'france' | 'corse' | 'domtom1' | 'domtom2';

const amountTTC = z.number().positive().multipleOf(0.01);

/** Forfait : le poids n'entre pas dans le montant. */
const FlatRuleSchema = z
  .object({
    mode: z.literal('flat'),
    /** Port facturé sous le seuil, en euros TTC. */
    flatFeeTTC: amountTTC,
    /** Sous-total TTC à partir duquel le port est offert (borne incluse). */
    freeFromSubtotalTTC: amountTTC,
  })
  .strict();

/** Grille au poids, lue en base. */
const WeightGridRuleSchema = z
  .object({
    mode: z.literal('weight_grid'),
    /** Sous-total TTC à partir duquel le port est offert (borne incluse). */
    freeFromSubtotalTTC: amountTTC,
    /** Port appliqué quand la grille de la zone ne peut pas être lue. */
    gridUnavailableFeeTTC: amountTTC,
  })
  .strict();

export const ShippingPolicySchema = z
  .object({
    france: FlatRuleSchema,
    corse: WeightGridRuleSchema,
    domtom1: WeightGridRuleSchema,
    domtom2: WeightGridRuleSchema,
  })
  .strict()
  .refine(
    (policy) => policy.france.flatFeeTTC < policy.france.freeFromSubtotalTTC,
    {
      message: 'le forfait doit rester inférieur au seuil de gratuité',
    },
  );

export type ShippingPolicy = z.infer<typeof ShippingPolicySchema>;
export type FlatShippingRule = z.infer<typeof FlatRuleSchema>;
export type WeightGridShippingRule = z.infer<typeof WeightGridRuleSchema>;

/** Valeurs d'avant le mandat BJ pour les zones restées à la grille au poids. */
const WEIGHT_GRID_RULE_BEFORE_BJ: WeightGridShippingRule = {
  mode: 'weight_grid',
  freeFromSubtotalTTC: 150,
  gridUnavailableFeeTTC: 15.9,
};

/** Un schéma invalide arrête le chargement du module : pas de valeur de repli. */
export const SHIPPING_POLICY: Readonly<ShippingPolicy> = Object.freeze(
  ShippingPolicySchema.parse({
    france: { mode: 'flat', flatFeeTTC: 9.9, freeFromSubtotalTTC: 100 },
    corse: { ...WEIGHT_GRID_RULE_BEFORE_BJ },
    domtom1: { ...WEIGHT_GRID_RULE_BEFORE_BJ },
    domtom2: { ...WEIGHT_GRID_RULE_BEFORE_BJ },
  }),
);

/**
 * Port TTC d'un panier non vide livré en France métropolitaine : le forfait sous
 * le seuil, 0 à partir du seuil. Le poids n'est pas un paramètre.
 */
export function metropolitanShippingFeeTTC(subtotalTTC: number): number {
  const { flatFeeTTC, freeFromSubtotalTTC } = SHIPPING_POLICY.france;
  return subtotalTTC >= freeFromSubtotalTTC ? 0 : flatFeeTTC;
}

/** Ce que le frontend reçoit : la règle de la France métropolitaine. */
export interface PublicShippingPolicy {
  flatFeeTTC: number;
  freeShippingThresholdTTC: number;
}

export function publicShippingPolicy(): PublicShippingPolicy {
  return {
    flatFeeTTC: SHIPPING_POLICY.france.flatFeeTTC,
    freeShippingThresholdTTC: SHIPPING_POLICY.france.freeFromSubtotalTTC,
  };
}

/**
 * Formulation exacte de la promesse de gratuité (France métropolitaine), imposée
 * aux textes générés : « Livraison gratuite dès 100€ ».
 */
export function freeShippingWording(): string {
  return `Livraison gratuite dès ${SHIPPING_POLICY.france.freeFromSubtotalTTC}€`;
}
