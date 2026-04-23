/**
 * Types publics partages pour les composants diagnostic-public.
 * Aligne sur les reponses du backend /api/diagnostic-engine/*.
 */

export interface DiagSystemPublic {
  slug: string;
  label: string;
  description: string | null;
  icon_slug: string | null;
  color_token: string | null;
}

export interface PopularSymptomPublic {
  slug: string;
  label: string;
  system_slug: string;
  system_label: string;
  urgency: string;
  session_count: number;
}

export interface PopularMaintenancePublic {
  slug: string;
  label: string;
  system_slug: string;
  severity_if_overdue: string | null;
  related_pg_id: number | null;
  popularity_score: number;
}

export interface SearchHitPublic {
  type: "symptom" | "maintenance" | "dtc";
  slug: string;
  label: string;
  system_slug: string | null;
  urgency: string | null;
  score: number;
}

export interface MaintenanceOpPublic {
  slug: string;
  label: string;
  description: string | null;
  system_id: number;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  severity_if_overdue: string | null;
  normal_wear_km_min: number | null;
  normal_wear_km_max: number | null;
  related_gamme_slug: string | null;
  related_pg_id: number | null;
}
