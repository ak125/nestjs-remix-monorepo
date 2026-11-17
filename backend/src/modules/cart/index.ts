// Surface publique du module panier pour les autres modules
// (règle dependency-cruiser `no-deep-module-access`).
// Seule la politique des frais de port est exposée ici : source unique du
// forfait et du seuil de gratuité (mandat BJ).
export {
  SHIPPING_POLICY,
  freeShippingWording,
  metropolitanShippingFeeTTC,
} from './config/shipping-policy.config';
