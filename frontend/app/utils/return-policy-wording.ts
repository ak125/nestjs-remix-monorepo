/**
 * Formulations publiques de la politique de retour (mandat BJ, complément du
 * 18/11/2026). Le délai, les frais et le moyen de remboursement viennent de la
 * règle servie par le backend (`useReturnPolicy()`, source unique
 * `backend/src/modules/cart/config/return-policy.config.ts`) : ces fonctions
 * n'en portent aucune valeur, elles l'écrivent.
 *
 * Quand la règle n'a pas pu être lue (`null`), l'appelant n'affiche rien sur
 * les retours : aucune de ces fonctions n'est appelée.
 *
 * Aucune formulation ne présente le retour comme gratuit : il est à la charge
 * du client, sauf pièce défectueuse ou erreur de notre part.
 */
import { type ReturnPolicyResult } from "~/utils/remix-application-port";

const WAIVER_WORDING: Record<
  ReturnPolicyResult["returnFeesWaivedFor"][number],
  string
> = {
  item_defect: "pièce défectueuse",
  seller_error: "erreur de notre part",
};

/** « Retours 30 jours ». */
export function returnWindowLabel(policy: ReturnPolicyResult): string {
  return `Retours ${policy.returnWindowDays} jours`;
}

/** « Frais de retour à votre charge, sauf pièce défectueuse ou erreur de notre part ». */
export function returnFeesWording(policy: ReturnPolicyResult): string {
  const waivers = policy.returnFeesWaivedFor.map((w) => WAIVER_WORDING[w]);
  return waivers.length > 0
    ? `Frais de retour à votre charge, sauf ${waivers.join(" ou ")}`
    : "Frais de retour à votre charge";
}

/** Réponse de la FAQ « Comment retourner une pièce ? ». */
export function returnFaqAnswer(policy: ReturnPolicyResult): string {
  return (
    `Vous disposez de ${policy.returnWindowDays} jours après réception pour retourner une pièce, ` +
    `dans son emballage d'origine et non montée. ${returnFeesWording(policy)}. ` +
    `Le remboursement est effectué par le moyen de paiement utilisé lors de la commande.`
  );
}
