/**
 * Supplier Truth Module - Index d'exports
 * Surface publique pour les autres modules (règle `no-deep-module-access`).
 * Seul lecteur autorisé de `___xtr_supplier` (ast-grep `commerce-no-direct-supplier-read`).
 */

// Annuaire fournisseur (`getSupplierDirectory`) : libellé `pri_frs` du commit
// d'import tarifaire (PricingModule, via SupplierTruthReadModule).
export { SupplierTruthRepository } from './supplier-truth.repository';
