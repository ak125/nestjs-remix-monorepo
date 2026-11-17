// Surface publique du module panier pour les autres modules
// (règle dependency-cruiser `no-deep-module-access`).
// Sont exposées ici les politiques de port (forfait, seuil de gratuité) et de
// retour (délai, frais, remboursement) : sources uniques (mandat BJ).
export {
  SHIPPING_POLICY,
  freeShippingWording,
  metropolitanShippingFeeTTC,
} from './config/shipping-policy.config';
export { RETURN_POLICY, returnFaqAnswer } from './config/return-policy.config';
