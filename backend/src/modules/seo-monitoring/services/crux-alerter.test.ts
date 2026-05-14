/**
 * Unit tests for CruxAlerterService (ADR-063 PR-4).
 *
 * Pure-function coverage (no fetch, no fake timers) :
 *  - evaluateAbsolute() Google Web Vitals thresholds
 *  - evaluateDelta() Δ% vs trailing-4 baseline
 *  - transitionState() state machine logic
 *
 * Sinks + DB persistence covered via PR-5 preprod integration.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CruxAlerterService } from './crux-alerter.service';

async function buildService(): Promise<CruxAlerterService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CruxAlerterService,
      {
        provide: ConfigService,
        useValue: { get: () => undefined },
      },
    ],
  }).compile();
  return moduleRef.get(CruxAlerterService);
}

describe('CruxAlerterService', () => {
  describe('evaluateAbsolute — Google Web Vitals thresholds', () => {
    let svc: CruxAlerterService;
    beforeAll(async () => {
      svc = await buildService();
    });

    it('LCP < 2500ms → null (good)', () => {
      expect(svc.evaluateAbsolute('lcp', 2300)).toBeNull();
    });
    it('LCP 2500-3999ms → WARN', () => {
      expect(svc.evaluateAbsolute('lcp', 2500)).toBe('WARN');
      expect(svc.evaluateAbsolute('lcp', 3999)).toBe('WARN');
    });
    it('LCP >= 4000ms → CRIT', () => {
      expect(svc.evaluateAbsolute('lcp', 4000)).toBe('CRIT');
      expect(svc.evaluateAbsolute('lcp', 5500)).toBe('CRIT');
    });

    it('INP < 200ms → null', () => {
      expect(svc.evaluateAbsolute('inp', 180)).toBeNull();
    });
    it('INP 200-499ms → WARN', () => {
      expect(svc.evaluateAbsolute('inp', 200)).toBe('WARN');
    });
    it('INP >= 500ms → CRIT', () => {
      expect(svc.evaluateAbsolute('inp', 500)).toBe('CRIT');
    });

    it('CLS < 0.1 → null', () => {
      expect(svc.evaluateAbsolute('cls', 0.08)).toBeNull();
    });
    it('CLS 0.1-0.249 → WARN', () => {
      expect(svc.evaluateAbsolute('cls', 0.1)).toBe('WARN');
    });
    it('CLS >= 0.25 → CRIT', () => {
      expect(svc.evaluateAbsolute('cls', 0.25)).toBe('CRIT');
    });

    it('TTFB / FCP return null (no V1 absolute threshold)', () => {
      expect(svc.evaluateAbsolute('ttfb', 5000)).toBeNull();
      expect(svc.evaluateAbsolute('fcp', 5000)).toBeNull();
    });
  });

  describe('evaluateDelta — Δ% vs trailing-4 baseline', () => {
    let svc: CruxAlerterService;
    beforeAll(async () => {
      svc = await buildService();
    });

    it('returns null severity if baseline < 4 periods', () => {
      const r = svc.evaluateDelta('lcp', 3000, [1800, 1820, 1810]);
      expect(r.severity).toBeNull();
      expect(r.baselineMedian).toBeNull();
    });

    it('LCP +15%/+200ms → WARN', () => {
      // baseline median = 1800ms ; current 2100ms = +300ms +16.7%
      const r = svc.evaluateDelta('lcp', 2100, [1800, 1800, 1800, 1800]);
      expect(r.severity).toBe('WARN');
      expect(r.baselineMedian).toBe(1800);
      expect(r.deltaPct).toBeCloseTo(16.67, 0);
    });

    it('LCP +30%/+400ms → CRIT', () => {
      // baseline 1800 ; current 2400 = +600ms +33%
      const r = svc.evaluateDelta('lcp', 2400, [1800, 1800, 1800, 1800]);
      expect(r.severity).toBe('CRIT');
    });

    it('LCP +15% but absolute delta < 200ms → null (noise guard)', () => {
      // baseline 1000 ; current 1170 = +170ms +17%
      const r = svc.evaluateDelta('lcp', 1170, [1000, 1000, 1000, 1000]);
      expect(r.severity).toBeNull();
    });

    it('returns null if baseline median <= 0', () => {
      const r = svc.evaluateDelta('lcp', 2000, [0, 0, 0, 0]);
      expect(r.severity).toBeNull();
    });
  });

  describe('transitionState — state machine', () => {
    let svc: CruxAlerterService;
    beforeAll(async () => {
      svc = await buildService();
    });

    it('null severity + no existing → no-op', () => {
      expect(svc.transitionState(null, null)).toBeNull();
    });

    it('null severity + existing OPEN → RESOLVED', () => {
      expect(
        svc.transitionState(
          { state: 'OPEN', severity: 'WARN', lastEmittedAt: new Date() },
          null,
        ),
      ).toBe('RESOLVED');
    });

    it('null severity + existing RESOLVED → no-op', () => {
      expect(
        svc.transitionState(
          { state: 'RESOLVED', severity: 'WARN', lastEmittedAt: new Date() },
          null,
        ),
      ).toBeNull();
    });

    it('new severity + no existing → OPEN', () => {
      expect(svc.transitionState(null, 'WARN')).toBe('OPEN');
    });

    it('new severity + existing RESOLVED → OPEN (re-open)', () => {
      expect(
        svc.transitionState(
          { state: 'RESOLVED', severity: 'WARN', lastEmittedAt: new Date() },
          'WARN',
        ),
      ).toBe('OPEN');
    });

    it('same severity + within 7 days → no-op (anti-spam)', () => {
      const recent = new Date('2026-05-12');
      const now = new Date('2026-05-14');
      expect(
        svc.transitionState(
          { state: 'OPEN', severity: 'WARN', lastEmittedAt: recent },
          'WARN',
          now,
        ),
      ).toBeNull();
    });

    it('same severity + last emit > 7 days → STILL_OPEN (weekly)', () => {
      const old = new Date('2026-05-01');
      const now = new Date('2026-05-14');
      expect(
        svc.transitionState(
          { state: 'OPEN', severity: 'WARN', lastEmittedAt: old },
          'WARN',
          now,
        ),
      ).toBe('STILL_OPEN');
    });

    it('escalation WARN → CRIT re-fires OPEN', () => {
      const recent = new Date('2026-05-13');
      const now = new Date('2026-05-14');
      expect(
        svc.transitionState(
          { state: 'OPEN', severity: 'WARN', lastEmittedAt: recent },
          'CRIT',
          now,
        ),
      ).toBe('OPEN');
    });
  });
});
