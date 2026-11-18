/**
 * Supplier-truth — surface publique pour les autres modules (règle
 * `no-deep-module-access`). Les modules NestJS restent importés par leur
 * fichier `*.module.ts`.
 */

// Lecture d'une offre fournisseur : forme commune au relevé (DEV) et aux
// contrôles de préparation (PROD), mandat BK et complément n° 4.
export type {
  LectureLive,
  ResultatLecture,
} from './supplier-live-quote.service';

// Relevés datés (`supplier_offer_snapshot`) : la PROD ne lit que ceux-ci, jamais
// un portail (complément BK n° 4).
export {
  FRAICHEUR_RELEVE_MAX_MINUTES,
  lectureDepuisReleve,
  releveEstFrais,
} from './supplier-offer-releve';
