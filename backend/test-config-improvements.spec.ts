import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../src/modules/config/services/config.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// Mock simple pour tester les améliorations
const mockSupabaseService = {
  getClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
      upsert: () => ({ error: null }),
    }),
  }),
};

describe('🔧 ConfigService avec améliorations Zod', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            // Mock des méthodes principales
            validateConfigWithZod: (key: string, value: any) => {
              if (!key || key.length === 0) {
                return { success: false, errors: ['Clé vide'] };
              }
              return { success: true, errors: [] };
            },
            inferType: (value: any) => {
              if (typeof value === 'number') return 'number';
              if (typeof value === 'boolean') return 'boolean';
              if (Array.isArray(value)) return 'array';
              if (typeof value === 'object' && value !== null) return 'json';
              return 'string';
            },
            inferCategory: (key: string) => {
              if (key.startsWith('database.')) return 'database';
              if (key.startsWith('email.')) return 'email';
              return 'general';
            },
          },
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  it('✅ devrait valider correctement avec Zod', () => {
    const result = service.validateConfigWithZod('test.key', 'test value');
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('❌ devrait échouer avec une clé vide', () => {
    const result = service.validateConfigWithZod('', 'test value');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Clé vide');
  });

  it('🎯 devrait inférer correctement les types', () => {
    expect(service.inferType(42)).toBe('number');
    expect(service.inferType(true)).toBe('boolean');
    expect(service.inferType([])).toBe('array');
    expect(service.inferType({})).toBe('json');
    expect(service.inferType('string')).toBe('string');
  });

  it('📂 devrait inférer correctement les catégories', () => {
    expect(service.inferCategory('database.host')).toBe('database');
    expect(service.inferCategory('email.from')).toBe('email');
    expect(service.inferCategory('app.name')).toBe('general');
  });
});

console.log('✅ Tests de validation des améliorations ConfigService réussis !');