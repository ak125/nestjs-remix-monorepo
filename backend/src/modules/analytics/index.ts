/**
 * Analytics Module - Index d'exports
 * Surface publique pour les autres modules (règle `no-deep-module-access`).
 */

// Relais Data → Ventes : verdict `tracking-integrity-verdict.v1` (contrat + producteur)
export { TrackingIntegrityService } from './tracking-integrity/tracking-integrity.service';
export {
  TRACKING_INTEGRITY_CONTRACT,
  TrackingIntegrityVerdictV1Schema,
} from './tracking-integrity/tracking-integrity-verdict.schema';
export type {
  TrackingIntegrityCheck,
  TrackingIntegrityVerdictV1,
} from './tracking-integrity/tracking-integrity-verdict.schema';
