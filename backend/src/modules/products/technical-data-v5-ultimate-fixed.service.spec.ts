import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TechnicalDataServiceV5UltimateFixed } from './technical-data-v5-ultimate-fixed.service';

describe('TechnicalDataServiceV5UltimateFixed', () => {
  let service: TechnicalDataServiceV5UltimateFixed;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicalDataServiceV5UltimateFixed,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SUPABASE_URL') return 'http://localhost:54321';
              if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TechnicalDataServiceV5UltimateFixed>(TechnicalDataServiceV5UltimateFixed);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have health status', async () => {
    const health = await service.getHealthStatus();
    expect(health.service).toBe('TechnicalDataServiceV5UltimateFixed');
    expect(health.version).toBe('V5_ULTIMATE_FIXED');
    expect(health.methodology).toContain('vérifier existant avant et utiliser le meilleur et améliorer');
  });

  it('should have service stats', () => {
    const stats = service.getServiceStats();
    expect(stats.name).toBe('TechnicalDataServiceV5UltimateFixed');
    expect(stats.methodology).toContain('SUCCESS');
    expect(stats.features_count).toBe(6);
  });

  it('should handle cache invalidation', () => {
    expect(() => service.invalidateCache()).not.toThrow();
  });
});