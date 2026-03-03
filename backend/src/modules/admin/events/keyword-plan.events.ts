/**
 * Event emitted when a keyword plan is validated and conseil sections
 * need to be regenerated with the new include_terms / micro_phrases.
 *
 * Flow: DB trigger → __pipeline_chain_queue → Poller → this event → ContentRefreshService
 */
export const KEYWORD_PLAN_VALIDATED = 'keyword-plan.validated';

export interface KeywordPlanValidatedEvent {
  /** Row ID in __pipeline_chain_queue */
  pcqId: number;
  /** pieces_gamme.pg_id */
  pgId: number;
  /** pieces_gamme.pg_alias (e.g. "cremailliere-de-direction") */
  pgAlias: string;
  /** Sections that need regeneration (from skp_audit_result.sections_to_improve) */
  sectionsToImprove: string[];
  /** ID of the validated keyword plan row */
  kpId: number;
  /** Per-section terms from skp_section_terms (include_terms, micro_phrases, forbidden_overlap) */
  sectionTerms: Record<
    string,
    {
      include_terms?: string[];
      micro_phrases?: string[];
      forbidden_overlap?: string[];
    }
  >;
}
