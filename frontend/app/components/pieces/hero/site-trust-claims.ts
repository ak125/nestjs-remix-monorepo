/**
 * SoT des garanties commerciales / légales affichées dans le hero R2.
 *
 * Ces claims figurent dans la `MetaStrip` du `PiecesHeroTrustStrip`.
 * **Anti-drift marketing** : tout ajout / modification / suppression doit
 * passer par ce fichier (un test vitest vérifie la longueur === 3 et
 * l'ordre canon shipping → returns → payment).
 *
 * Le libellé « retours » n'est pas écrit ici : il vient de la politique de
 * retour servie par le backend (`useReturnPolicy()`, mandat BJ). Sans
 * politique lue, la garantie « retours » est omise.
 *
 * Chaque claim a un champ `source` qui pointe la politique business
 * justifiant l'affichage public (audit trail légal).
 *
 * **Ne pas hardcoder ces labels dans les composants** — le test
 * `pieces-hero-meta-strip.test.tsx` (anti-drift section) bloque
 * toute string littérale dupliquée dans le rendu.
 */

import { BadgeCheck, ShieldCheck, Truck, type LucideIcon } from "lucide-react";

import { type ReturnPolicyResult } from "~/utils/remix-application-port";
import { returnWindowLabel } from "~/utils/return-policy-wording";

export interface TrustClaim {
  /** Identifiant stable (ne pas changer, ordre figé). */
  readonly id: "shipping" | "returns" | "payment";
  /** Icône Lucide affichée à gauche du label. */
  readonly icon: LucideIcon;
  /** Libellé public (FR). */
  readonly label: string;
  /** Source business/légale (audit trail — politique / module gateway). */
  readonly source: string;
}

export function siteTrustClaims(
  returnPolicy: ReturnPolicyResult | null,
): readonly TrustClaim[] {
  return [
    {
      id: "shipping",
      icon: Truck,
      label: "Expédition 24h",
      source: "policy-2026-Q2",
    },
    ...(returnPolicy
      ? [
          {
            id: "returns" as const,
            icon: BadgeCheck,
            label: returnWindowLabel(returnPolicy),
            source: "return-policy.config",
          },
        ]
      : []),
    {
      id: "payment",
      icon: ShieldCheck,
      label: "Paiement sécurisé",
      source: "paybox-systempay",
    },
  ];
}
