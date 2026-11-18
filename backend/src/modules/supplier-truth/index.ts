/**
 * Supplier-truth — surface publique pour les autres modules (règle
 * `no-deep-module-access`). Les modules NestJS restent importés par leur
 * fichier `*.module.ts`.
 */

// Relecture live en lecture seule du portail du fournisseur proposé (mandat BK)
export { SupplierLiveQuoteService } from './supplier-live-quote.service';
export type {
  LectureLive,
  ResultatLecture,
} from './supplier-live-quote.service';

// Annuaire fournisseur (`getSupplierDirectory`) : libellé `pri_frs` du commit
// d'import tarifaire (PricingModule, via SupplierTruthReadModule). Seul lecteur
// autorisé de `___xtr_supplier` (ast-grep `commerce-no-direct-supplier-read`).
export { SupplierTruthRepository } from './supplier-truth.repository';

// Fiche fournisseur, lecture et écriture de ___xtr_supplier (mandat CH)
export {
  SupplierCardRepository,
  SupplierIdConflictError,
  SUPPLIER_CARD_COLUMNS,
} from './supplier-card.repository';
export type {
  SupplierCardRow,
  SupplierCardPatch,
  SupplierIdentity,
  SupplierLinkedBrand,
  SupplierPriceProfileRow,
} from './supplier-card.repository';
