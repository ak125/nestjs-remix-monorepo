// Surface publique du module pricing (règle depcruise no-deep-module-access).
// Mandat BM : la facture dérive son HT du même taux de TVA par défaut que le
// calcul de prix, sans copie de la constante.
export { DEFAULT_TVA_RATE } from './services/pricing-formula.service';
