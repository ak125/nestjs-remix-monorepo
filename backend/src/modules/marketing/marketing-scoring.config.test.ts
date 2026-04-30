import {
  computeBriefScore,
  getMarketingScoringWeights,
  MARKETING_SCORING_DEFAULTS,
  MarketingBriefMetrics,
} from './marketing-scoring.config';

describe('Marketing scoring config', () => {
  describe('getMarketingScoringWeights()', () => {
    it('returns defaults when env vars absent', () => {
      const w = getMarketingScoringWeights({});
      expect(w).toEqual(MARKETING_SCORING_DEFAULTS);
    });

    it('overrides individual weights via ENV', () => {
      const w = getMarketingScoringWeights({
        MARKETING_SCORING_CALL: '5',
        MARKETING_SCORING_ORDER: '20',
      } as NodeJS.ProcessEnv);
      expect(w.call).toBe(5);
      expect(w.order).toBe(20);
      // unchanged
      expect(w.visit).toBe(MARKETING_SCORING_DEFAULTS.visit);
    });

    it('falls back to default on invalid env value', () => {
      const w = getMarketingScoringWeights({
        MARKETING_SCORING_CALL: 'not-a-number',
      } as NodeJS.ProcessEnv);
      expect(w.call).toBe(MARKETING_SCORING_DEFAULTS.call);
    });

    it('falls back to default on empty string', () => {
      const w = getMarketingScoringWeights({
        MARKETING_SCORING_CALL: '',
      } as NodeJS.ProcessEnv);
      expect(w.call).toBe(MARKETING_SCORING_DEFAULTS.call);
    });

    it('accepts decimal values (revenue ratio)', () => {
      const w = getMarketingScoringWeights({
        MARKETING_SCORING_REVENUE_EUR_PER_UNIT: '0.05',
      } as NodeJS.ProcessEnv);
      expect(w.revenue_eur_per_unit).toBe(0.05);
    });
  });

  describe('computeBriefScore()', () => {
    it('returns 0 for empty metrics', () => {
      expect(computeBriefScore({})).toBe(0);
    });

    it('applies default weights correctly', () => {
      const metrics: MarketingBriefMetrics = {
        actual_calls: 1,
        actual_clicks: 5,
        actual_orders: 1,
      };
      // call=3 + click=1*5 + order=10 = 18
      expect(computeBriefScore(metrics)).toBe(18);
    });

    it('treats undefined fields as 0', () => {
      const metrics: MarketingBriefMetrics = { actual_calls: 2 };
      // 2 * 3 = 6, all other = 0
      expect(computeBriefScore(metrics)).toBe(6);
    });

    it('converts revenue_cents to euros for ratio', () => {
      const metrics: MarketingBriefMetrics = {
        actual_revenue_cents: 10000, // 100 €
      };
      // 100 € * 0.1 = 10
      expect(computeBriefScore(metrics)).toBe(10);
    });

    it('respects custom weights override', () => {
      const customWeights = {
        ...MARKETING_SCORING_DEFAULTS,
        call: 100,
      };
      const metrics: MarketingBriefMetrics = { actual_calls: 1 };
      expect(computeBriefScore(metrics, customWeights)).toBe(100);
    });

    it('impressions default to 0 weight (no ROI per-impression)', () => {
      const metrics: MarketingBriefMetrics = {
        actual_impressions: 1_000_000,
      };
      expect(computeBriefScore(metrics)).toBe(0);
    });

    it('compose all metrics correctly', () => {
      const metrics: MarketingBriefMetrics = {
        actual_impressions: 100,
        actual_clicks: 10,
        actual_calls: 2,
        actual_visits: 1,
        actual_quotes: 1,
        actual_orders: 1,
        actual_revenue_cents: 5000, // 50 €
      };
      // impression=0*100 + click=1*10 + call=3*2 + visit=2*1 + quote=2*1 + order=10*1 + revenue=0.1*50
      // = 0 + 10 + 6 + 2 + 2 + 10 + 5 = 35
      expect(computeBriefScore(metrics)).toBe(35);
    });
  });
});
