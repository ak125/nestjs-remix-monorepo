import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedConfigService } from '../services/enhanced-config.service';
import { CacheService } from '../../../cache/cache.service';
import { ConfigService } from '@nestjs/config';

// Mock de Supabase
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => ({ data: [], error: null })),
      eq: jest.fn(() => ({
        single: jest.fn(() => ({ data: { config_value: 'test' }, error: null }))
      }))
    })),
    upsert: jest.fn(() => ({ error: null })),
    delete: jest.fn(() => ({ error: null }))
  }))
};

describe('EnhancedConfigService', () => {
  let service: EnhancedConfigService;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'http://localhost:54321';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'fake-service-key';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedConfigService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EnhancedConfigService>(EnhancedConfigService);
    
    // Mock du client Supabase après création
    service['supabase'] = mockSupabaseClient as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have supabase client mocked', () => {
    expect(service['supabase']).toBeDefined();
    expect(service['supabase'].from).toBeDefined();
  });

  it('should get config from cache', async () => {
    const mockCacheService = service['cacheService'];
    mockCacheService.get = jest.fn().mockResolvedValue('cached-value');

    const result = await service.get('test-key');
    expect(result).toBe('cached-value');
    expect(mockCacheService.get).toHaveBeenCalledWith('config:test-key');
  });
});
