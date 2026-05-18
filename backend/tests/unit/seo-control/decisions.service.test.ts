/**
 * PR-SBD-1 Task 3 — SeoControlDecisionsService unit tests.
 *
 * Pattern Jest (cf. backend/jest.config.js).
 *
 * Verifies :
 *   - Every branch emits a rule_id from the V1 catalogue
 *   - role_id derives correctly from primary rule_id
 *   - Fallbacks (LOSER_UNCLEAR_V1, ALERT_UNKNOWN_V1) fire when expected
 *   - All emitted rule_ids ⊂ DECISION_RULE_IDS
 *   - All emitted role_ids ⊂ ROLE_IDS
 */
import {
  DECISION_RULE_IDS,
  ROLE_IDS,
  SEO_CONTROL_DECISION_RULES_V1,
} from '@repo/seo-types';
import { SeoControlDecisionsService } from '../../../src/modules/admin/services/seo-control-decisions.service';

describe('SeoControlDecisionsService', () => {
  const service = new SeoControlDecisionsService();

  describe('deriveLoser', () => {
    it('emits LOSER_RANK_DROP_V1 when position_delta > 2', () => {
      const d = service.deriveLoser({
        delta_pct: -50,
        position_current: 8,
        position_delta: 5,
        impressions_current: 500,
      });
      expect(d.decision_rule_ids).toContain('LOSER_RANK_DROP_V1');
      expect(d.suspected_causes).toContain('ranking_drop');
      expect(d.recommended_actions).toContain('audit_canonical');
    });

    it('emits LOSER_CTR_DROP_STABLE_POS_V1 when delta_pct<-30 + position_delta<=1', () => {
      const d = service.deriveLoser({
        delta_pct: -45,
        position_current: 4,
        position_delta: 0.5,
        impressions_current: 1000,
      });
      expect(d.decision_rule_ids).toContain('LOSER_CTR_DROP_STABLE_POS_V1');
      expect(d.suspected_causes).toContain('ctr_drop_at_stable_position');
      expect(d.recommended_actions).toContain('audit_meta_title_description');
    });

    it('emits LOSER_LOST_VISIBILITY_V1 when position>20 + impressions>100', () => {
      const d = service.deriveLoser({
        delta_pct: null,
        position_current: 35,
        position_delta: 1,
        impressions_current: 250,
      });
      expect(d.decision_rule_ids).toContain('LOSER_LOST_VISIBILITY_V1');
      expect(d.suspected_causes).toContain('lost_serp_visibility');
    });

    it('falls back to LOSER_UNCLEAR_V1 when no signal matches', () => {
      const d = service.deriveLoser({
        delta_pct: -10,
        position_current: 5,
        position_delta: 0,
        impressions_current: 50,
      });
      expect(d.decision_rule_ids).toEqual(['LOSER_UNCLEAR_V1']);
      expect(d.suspected_causes).toContain('unclear_signal');
    });

    it('role_id = seo-content for losers (catalogue mapping)', () => {
      const d = service.deriveLoser({
        delta_pct: -50,
        position_current: 8,
        position_delta: 5,
        impressions_current: 500,
      });
      expect(d.role_id).toBe('seo-content');
    });
  });

  describe('deriveLowCtr', () => {
    it('emits LOWCTR_TOP5_META_MISMATCH_V1 for top5 band', () => {
      const d = service.deriveLowCtr({
        position_band: 'top5',
        ctr: 0.002,
        impressions: 2000,
      });
      expect(d.decision_rule_ids).toEqual(['LOWCTR_TOP5_META_MISMATCH_V1']);
      expect(d.recommended_actions).toContain('rewrite_meta_description');
      expect(d.role_id).toBe('seo-content');
    });

    it('emits LOWCTR_TOP15_TITLE_APPEAL_V1 for top15 band', () => {
      const d = service.deriveLowCtr({
        position_band: 'top15',
        ctr: 0.008,
        impressions: 500,
      });
      expect(d.decision_rule_ids).toEqual(['LOWCTR_TOP15_TITLE_APPEAL_V1']);
      expect(d.recommended_actions).toContain('ab_test_title');
    });

    it('emits LOWCTR_BEYOND_RANK_FIRST_V1 + role=seo-qa for beyond band', () => {
      const d = service.deriveLowCtr({
        position_band: 'beyond',
        ctr: 0.001,
        impressions: 200,
      });
      expect(d.decision_rule_ids).toEqual(['LOWCTR_BEYOND_RANK_FIRST_V1']);
      expect(d.role_id).toBe('seo-qa');
    });
  });

  describe('deriveAlert', () => {
    it('emits ALERT_CANONICAL_DRIFT_V1 for canonical_conflict + role=seo-qa', () => {
      const d = service.deriveAlert({ alert_type: 'canonical_conflict' });
      expect(d.decision_rule_ids).toEqual(['ALERT_CANONICAL_DRIFT_V1']);
      expect(d.role_id).toBe('seo-qa');
    });

    it('emits ALERT_INGESTION_FAILED_V1 + role=rag-lead', () => {
      const d = service.deriveAlert({ alert_type: 'ingestion_run_failed' });
      expect(d.decision_rule_ids).toEqual(['ALERT_INGESTION_FAILED_V1']);
      expect(d.role_id).toBe('rag-lead');
    });

    it('emits ALERT_ANOMALY_V1 + role=cto for anomaly_detected', () => {
      const d = service.deriveAlert({ alert_type: 'anomaly_detected' });
      expect(d.decision_rule_ids).toEqual(['ALERT_ANOMALY_V1']);
      expect(d.role_id).toBe('cto');
    });

    it('falls back to ALERT_UNKNOWN_V1 for unrecognised type', () => {
      const d = service.deriveAlert({ alert_type: 'never_seen_before' });
      expect(d.decision_rule_ids).toEqual(['ALERT_UNKNOWN_V1']);
      expect(d.role_id).toBe('cto');
    });
  });

  describe('deriveConversion', () => {
    it('emits CONV_CRITICAL_FUNNEL_BLOCK_V1 when orders=0 + sessions>200', () => {
      const d = service.deriveConversion({
        sessions: 300,
        orders_count: 0,
        conversion_rate: 0,
      });
      expect(d.decision_rule_ids).toEqual(['CONV_CRITICAL_FUNNEL_BLOCK_V1']);
      expect(d.role_id).toBe('cmo');
      expect(d.recommended_actions).toContain('audit_product_availability');
    });

    it('emits CONV_WEAK_MATCH_V1 when conversion_rate<0.5%', () => {
      const d = service.deriveConversion({
        sessions: 500,
        orders_count: 2,
        conversion_rate: 0.4,
      });
      expect(d.decision_rule_ids).toEqual(['CONV_WEAK_MATCH_V1']);
    });

    it('emits CONV_BELOW_AVG_V1 fallback', () => {
      const d = service.deriveConversion({
        sessions: 100,
        orders_count: 1,
        conversion_rate: 1.0,
      });
      expect(d.decision_rule_ids).toEqual(['CONV_BELOW_AVG_V1']);
    });
  });

  describe('Catalogue invariants', () => {
    it('every emitted rule_id exists in DECISION_RULE_IDS catalogue', () => {
      const samples = [
        service.deriveLoser({
          delta_pct: -50,
          position_current: 8,
          position_delta: 5,
          impressions_current: 500,
        }),
        service.deriveLowCtr({ position_band: 'top5', ctr: 0.001, impressions: 1000 }),
        service.deriveAlert({ alert_type: 'canonical_conflict' }),
        service.deriveConversion({ sessions: 300, orders_count: 0, conversion_rate: 0 }),
      ];
      for (const d of samples) {
        for (const ruleId of d.decision_rule_ids) {
          expect(DECISION_RULE_IDS as string[]).toContain(ruleId);
        }
      }
    });

    it('every emitted role_id is in ROLE_IDS enum', () => {
      const samples = [
        service.deriveLoser({
          delta_pct: -50,
          position_current: 8,
          position_delta: 5,
          impressions_current: 500,
        }),
        service.deriveLowCtr({ position_band: 'beyond', ctr: 0.001, impressions: 100 }),
        service.deriveAlert({ alert_type: 'ingestion_run_failed' }),
        service.deriveConversion({ sessions: 300, orders_count: 0, conversion_rate: 0 }),
      ];
      for (const d of samples) {
        expect(ROLE_IDS as readonly string[]).toContain(d.role_id);
      }
    });

    it('role_id matches catalogue role_default for primary rule_id', () => {
      const d = service.deriveAlert({ alert_type: 'schema_violation' });
      const primaryRule = d.decision_rule_ids[0];
      expect(d.role_id).toBe(
        SEO_CONTROL_DECISION_RULES_V1[primaryRule].role_default,
      );
    });
  });
});
