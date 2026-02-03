/**
 * RiskFlagsEngineService Tests
 *
 * Tests the SEO risk flags calculation engine including:
 * - Risk flag determination from entity metrics
 * - Risk level calculation (0-100)
 * - Alert type mapping
 *
 * Risk Flags Priority (highest to lowest):
 * 1. CONFUSION: confusion_risk >= 50 (BLOQUANT)
 * 2. ORPHAN: inbound_links = 0 (will be dropped)
 * 3. DUPLICATE: duplication_risk > 50 (unstable)
 * 4. WEAK_CLUSTER: cluster_size < 3 (fragile)
 * 5. LOW_CRAWL: crawl_frequency < 0.5/week (ignored)
 *
 * NOTE: Uses real Supabase credentials from .env.test (loaded via setup.ts)
 * No mocking of SupabaseBaseService - the pure calculation methods
 * don't actually call Supabase.
 *
 * @see backend/src/modules/seo/services/risk-flags-engine.service.ts
 */

import {
  RiskFlagsEngineService,
  EntityMetrics,
  RiskFlag,
  AlertType,
} from '../../../src/modules/seo/services/risk-flags-engine.service';
import { RpcGateService } from '../../../src/security/rpc-gate/rpc-gate.service';

// Minimal mock for RpcGateService (required dependency)
const mockRpcGate = {
  evaluate: jest.fn().mockReturnValue({ decision: 'ALLOW', reason: 'TEST' }),
  logRpcCall: jest.fn(),
} as unknown as RpcGateService;

describe('RiskFlagsEngineService', () => {
  let service: RiskFlagsEngineService;

  beforeEach(() => {
    service = new RiskFlagsEngineService(mockRpcGate);
  });

  // ═══════════════════════════════════════════════════════════════
  // RISK FLAG CALCULATION
  // Determines the risk flag based on entity metrics
  // Priority: CONFUSION > ORPHAN > DUPLICATE > WEAK_CLUSTER > LOW_CRAWL
  // ═══════════════════════════════════════════════════════════════
  describe('calculateRiskFlag()', () => {
    describe('CONFUSION flag (highest priority)', () => {
      it('returns CONFUSION when confusionRisk >= 50', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 50,
          inboundLinks: 10,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('CONFUSION');
      });

      it('returns CONFUSION for high confusionRisk (75)', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 75,
          inboundLinks: 0, // Would trigger ORPHAN, but CONFUSION is higher priority
          duplicationRisk: 100, // Would trigger DUPLICATE
          clusterSize: 1, // Would trigger WEAK_CLUSTER
          crawlFrequency: 0.1, // Would trigger LOW_CRAWL
        };

        expect(service.calculateRiskFlag(metrics)).toBe('CONFUSION');
      });

      it('does not return CONFUSION when confusionRisk < 50', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 49,
          inboundLinks: 10,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).not.toBe('CONFUSION');
      });
    });

    describe('ORPHAN flag (second priority)', () => {
      it('returns ORPHAN when inboundLinks = 0', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 0,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('ORPHAN');
      });

      it('does not return ORPHAN when inboundLinks > 0', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 1,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).not.toBe('ORPHAN');
      });
    });

    describe('DUPLICATE flag (third priority)', () => {
      it('returns DUPLICATE when duplicationRisk > 50', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 51,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('DUPLICATE');
      });

      it('does not return DUPLICATE when duplicationRisk <= 50', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 50,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).not.toBe('DUPLICATE');
      });
    });

    describe('WEAK_CLUSTER flag (fourth priority)', () => {
      it('returns WEAK_CLUSTER when clusterSize < 3', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 2,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('WEAK_CLUSTER');
      });

      it('returns WEAK_CLUSTER when clusterSize = 0', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 0,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('WEAK_CLUSTER');
      });

      it('does not return WEAK_CLUSTER when clusterSize >= 3', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 3,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskFlag(metrics)).not.toBe('WEAK_CLUSTER');
      });
    });

    describe('LOW_CRAWL flag (lowest priority)', () => {
      it('returns LOW_CRAWL when crawlFrequency < 0.5', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0.4,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('LOW_CRAWL');
      });

      it('returns LOW_CRAWL when crawlFrequency = 0', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0,
        };

        expect(service.calculateRiskFlag(metrics)).toBe('LOW_CRAWL');
      });

      it('does not return LOW_CRAWL when crawlFrequency >= 0.5', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0.5,
        };

        expect(service.calculateRiskFlag(metrics)).not.toBe('LOW_CRAWL');
      });
    });

    describe('No risk flag', () => {
      it('returns null when all metrics are healthy', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 10,
          duplicationRisk: 0,
          clusterSize: 10,
          crawlFrequency: 2.0,
        };

        expect(service.calculateRiskFlag(metrics)).toBeNull();
      });

      it('returns null when metrics are exactly at safe thresholds', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 49, // < 50
          inboundLinks: 1, // > 0
          duplicationRisk: 50, // <= 50
          clusterSize: 3, // >= 3
          crawlFrequency: 0.5, // >= 0.5
        };

        expect(service.calculateRiskFlag(metrics)).toBeNull();
      });
    });

    describe('Priority order verification', () => {
      it('CONFUSION takes priority over all others', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 50, // CONFUSION trigger
          inboundLinks: 0, // ORPHAN trigger
          duplicationRisk: 100, // DUPLICATE trigger
          clusterSize: 0, // WEAK_CLUSTER trigger
          crawlFrequency: 0, // LOW_CRAWL trigger
        };

        expect(service.calculateRiskFlag(metrics)).toBe('CONFUSION');
      });

      it('ORPHAN takes priority over DUPLICATE, WEAK_CLUSTER, LOW_CRAWL', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 0, // ORPHAN trigger
          duplicationRisk: 100, // DUPLICATE trigger
          clusterSize: 0, // WEAK_CLUSTER trigger
          crawlFrequency: 0, // LOW_CRAWL trigger
        };

        expect(service.calculateRiskFlag(metrics)).toBe('ORPHAN');
      });

      it('DUPLICATE takes priority over WEAK_CLUSTER, LOW_CRAWL', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 1,
          duplicationRisk: 100, // DUPLICATE trigger
          clusterSize: 0, // WEAK_CLUSTER trigger
          crawlFrequency: 0, // LOW_CRAWL trigger
        };

        expect(service.calculateRiskFlag(metrics)).toBe('DUPLICATE');
      });

      it('WEAK_CLUSTER takes priority over LOW_CRAWL', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 1,
          duplicationRisk: 0,
          clusterSize: 0, // WEAK_CLUSTER trigger
          crawlFrequency: 0, // LOW_CRAWL trigger
        };

        expect(service.calculateRiskFlag(metrics)).toBe('WEAK_CLUSTER');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RISK LEVEL CALCULATION
  // Returns urgency score 0-100 based on flag and metrics
  // ═══════════════════════════════════════════════════════════════
  describe('calculateRiskLevel()', () => {
    describe('No flag', () => {
      it('returns 0 when flag is null', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 10,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskLevel(metrics, null)).toBe(0);
      });
    });

    describe('CONFUSION flag', () => {
      it('returns 100 for CONFUSION (always max urgency)', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 50,
          inboundLinks: 10,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskLevel(metrics, 'CONFUSION')).toBe(100);
      });
    });

    describe('ORPHAN flag', () => {
      it('returns 90 for ORPHAN (very high urgency)', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 0,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskLevel(metrics, 'ORPHAN')).toBe(90);
      });
    });

    describe('DUPLICATE flag', () => {
      it('calculates risk level based on duplicationRisk', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 60,
          clusterSize: 5,
          crawlFrequency: 1,
        };

        // Formula: 50 + (duplicationRisk / 2) = 50 + 30 = 80
        expect(service.calculateRiskLevel(metrics, 'DUPLICATE')).toBe(80);
      });

      it('caps at 100 for very high duplicationRisk', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 150, // Would give 50 + 75 = 125
          clusterSize: 5,
          crawlFrequency: 1,
        };

        expect(service.calculateRiskLevel(metrics, 'DUPLICATE')).toBe(100);
      });
    });

    describe('WEAK_CLUSTER flag', () => {
      it('calculates risk level based on clusterSize', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 1,
          crawlFrequency: 1,
        };

        // Formula: max(40, 60 - clusterSize * 10) = max(40, 60 - 10) = 50
        expect(service.calculateRiskLevel(metrics, 'WEAK_CLUSTER')).toBe(50);
      });

      it('has minimum of 40 for large clusters', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5, // 60 - 50 = 10, but min is 40
          crawlFrequency: 1,
        };

        expect(service.calculateRiskLevel(metrics, 'WEAK_CLUSTER')).toBe(40);
      });
    });

    describe('LOW_CRAWL flag', () => {
      it('calculates risk level based on crawlFrequency', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0.1,
        };

        // Formula: max(50, 70 - (crawlFrequency * 100)) = max(50, 70 - 10) = 60
        expect(service.calculateRiskLevel(metrics, 'LOW_CRAWL')).toBe(60);
      });

      it('has minimum of 50 for moderate crawl frequency', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0.4, // 70 - 40 = 30, but min is 50
        };

        expect(service.calculateRiskLevel(metrics, 'LOW_CRAWL')).toBe(50);
      });

      it('handles zero crawlFrequency', () => {
        const metrics: EntityMetrics = {
          url: '/test',
          confusionRisk: 0,
          inboundLinks: 5,
          duplicationRisk: 0,
          clusterSize: 5,
          crawlFrequency: 0,
        };

        // 70 - 0 = 70
        expect(service.calculateRiskLevel(metrics, 'LOW_CRAWL')).toBe(70);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ALERT TYPE MAPPING
  // Maps risk flag to user-friendly alert type
  // Priority: CONFUSION > ORPHAN > isStale > other flags
  // ═══════════════════════════════════════════════════════════════
  describe('getAlertType()', () => {
    const alertMappings: Array<{
      flag: RiskFlag | null;
      isStale: boolean;
      expected: AlertType;
    }> = [
      { flag: 'CONFUSION', isStale: false, expected: 'BLOQUANT' },
      { flag: 'ORPHAN', isStale: false, expected: 'DANGER' },
      { flag: null, isStale: true, expected: 'DESINDEXATION_PROBABLE' },
      { flag: 'LOW_CRAWL', isStale: false, expected: 'RISQUE' },
      { flag: 'WEAK_CLUSTER', isStale: false, expected: 'RISQUE' },
      { flag: 'DUPLICATE', isStale: false, expected: 'INSTABLE' },
      { flag: null, isStale: false, expected: 'SURVEILLANCE' },
    ];

    it.each(alertMappings)(
      'returns $expected for flag=$flag, isStale=$isStale',
      ({ flag, isStale, expected }) => {
        expect(service.getAlertType(flag, isStale)).toBe(expected);
      },
    );

    it('uses default isStale=false when not provided', () => {
      expect(service.getAlertType(null)).toBe('SURVEILLANCE');
    });

    describe('isStale priority', () => {
      it('CONFUSION overrides isStale', () => {
        // CONFUSION is checked before isStale
        expect(service.getAlertType('CONFUSION', true)).toBe('BLOQUANT');
      });

      it('ORPHAN overrides isStale', () => {
        // ORPHAN is checked before isStale
        expect(service.getAlertType('ORPHAN', true)).toBe('DANGER');
      });

      it('isStale overrides LOW_CRAWL, WEAK_CLUSTER, DUPLICATE', () => {
        // Per implementation: isStale is checked AFTER CONFUSION/ORPHAN but BEFORE other flags
        expect(service.getAlertType('LOW_CRAWL', true)).toBe(
          'DESINDEXATION_PROBABLE',
        );
        expect(service.getAlertType('WEAK_CLUSTER', true)).toBe(
          'DESINDEXATION_PROBABLE',
        );
        expect(service.getAlertType('DUPLICATE', true)).toBe(
          'DESINDEXATION_PROBABLE',
        );
      });

      it('null flag with isStale returns DESINDEXATION_PROBABLE', () => {
        expect(service.getAlertType(null, true)).toBe('DESINDEXATION_PROBABLE');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES
  // Boundary conditions and special scenarios
  // ═══════════════════════════════════════════════════════════════
  describe('Edge Cases', () => {
    it('handles negative metric values gracefully', () => {
      const metrics: EntityMetrics = {
        url: '/test',
        confusionRisk: -10,
        inboundLinks: -5,
        duplicationRisk: -20,
        clusterSize: -1,
        crawlFrequency: -0.5,
      };

      // Should not throw
      expect(() => service.calculateRiskFlag(metrics)).not.toThrow();
    });

    it('handles very large metric values', () => {
      const metrics: EntityMetrics = {
        url: '/test',
        confusionRisk: 1000000,
        inboundLinks: 1000000,
        duplicationRisk: 1000000,
        clusterSize: 1000000,
        crawlFrequency: 1000000,
      };

      expect(service.calculateRiskFlag(metrics)).toBe('CONFUSION');
    });

    it('handles floating point edge cases', () => {
      const metrics: EntityMetrics = {
        url: '/test',
        confusionRisk: 49.9999999,
        inboundLinks: 0.0000001,
        duplicationRisk: 50.0000001,
        clusterSize: 2.9999999,
        crawlFrequency: 0.4999999,
      };

      // JavaScript floating point comparison
      // confusionRisk < 50 (doesn't trigger)
      // inboundLinks > 0 but very small (doesn't trigger ORPHAN)
      // duplicationRisk > 50 (triggers DUPLICATE)
      expect(service.calculateRiskFlag(metrics)).toBe('DUPLICATE');
    });

    it('handles entityId being undefined', () => {
      const metrics: EntityMetrics = {
        url: '/test',
        entityId: undefined,
        confusionRisk: 0,
        inboundLinks: 10,
        duplicationRisk: 0,
        clusterSize: 5,
        crawlFrequency: 1,
      };

      expect(service.calculateRiskFlag(metrics)).toBeNull();
    });
  });
});
