/**
 * Mini-CRM V0 — lifecycle des leads (contacts qualifiables).
 *
 * Source de vérité partagée FE/BE pour :
 *   - la liste fermée des statuts (CHECK contrainte en DB)
 *   - les transitions autorisées (invariant service-layer)
 *
 * Aligné avec la migration backend/supabase/migrations/20260528_xtr_msg_crm_v0.sql
 * (colonnes `msg_crm_*` sur ___xtr_msg).
 *
 * IMPORTANT : toute évolution de LEAD_STATUSES doit s'accompagner d'une
 * migration mettant à jour la CHECK contrainte `chk_msg_crm_status`.
 */

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Transitions autorisées depuis chaque statut.
 *
 * - `new`       → contacté ou perdu
 * - `contacted` → devisé, gagné direct, ou perdu
 * - `quoted`    → gagné, perdu, ou retour à contacté (re-discussion)
 * - `won`       → terminal (succès commercial)
 * - `lost`      → ré-ouverture vers `new` autorisée (lead recyclé)
 *
 * Validé côté service avant l'UPDATE en DB pour produire un BadRequestException
 * lisible (sinon la CHECK contrainte renvoie une erreur Postgres cryptique).
 */
export const LEAD_TRANSITIONS: Readonly<
  Record<LeadStatus, readonly LeadStatus[]>
> = {
  new: ['contacted', 'lost'],
  contacted: ['quoted', 'won', 'lost'],
  quoted: ['won', 'lost', 'contacted'],
  won: [],
  lost: ['new'],
} as const;

export function isValidLeadTransition(
  from: LeadStatus,
  to: LeadStatus,
): boolean {
  if (from === to) return true; // no-op = autorisé
  return LEAD_TRANSITIONS[from].includes(to);
}
