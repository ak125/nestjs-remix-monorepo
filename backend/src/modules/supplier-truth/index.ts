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
