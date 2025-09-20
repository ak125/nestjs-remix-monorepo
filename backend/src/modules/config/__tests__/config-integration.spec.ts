/**
 * Test d'intégration pour vérifier que le module config enhanced fonctionne
 * 
 * Ce test vérifie que notre service EnhancedConfigService s'intègre correctement
 * dans l'architecture NestJS et utilise la table ___config existante.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '../config.module';
import { EnhancedConfigService } from '../services/enhanced-config.service';

describe('ConfigModule Integration', () => {
  let module: TestingModule;
  let enhancedConfigService: EnhancedConfigService;

  beforeAll(async () => {
    // Variables d'environnement nécessaires pour les tests
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.REDIS_URL = 'redis://localhost:6379';

    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    enhancedConfigService = module.get<EnhancedConfigService>(EnhancedConfigService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should compile the config module', () => {
    expect(module).toBeDefined();
  });

  it('should provide EnhancedConfigService', () => {
    expect(enhancedConfigService).toBeDefined();
    expect(enhancedConfigService).toBeInstanceOf(EnhancedConfigService);
  });

  it('should have cache and encryption methods', () => {
    expect(enhancedConfigService.encryptValue).toBeDefined();
    expect(enhancedConfigService.decryptValue).toBeDefined();
    expect(enhancedConfigService.backup).toBeDefined();
    expect(enhancedConfigService.restore).toBeDefined();
  });

  it('should have CRUD methods for config', () => {
    expect(enhancedConfigService.get).toBeDefined();
    expect(enhancedConfigService.set).toBeDefined();
    expect(enhancedConfigService.delete).toBeDefined();
    expect(enhancedConfigService.search).toBeDefined();
    expect(enhancedConfigService.getByCategory).toBeDefined();
  });

  it('should encrypt and decrypt values', () => {
    const testValue = 'sensitive-data-123';
    const encrypted = enhancedConfigService.encryptValue(testValue);
    const decrypted = enhancedConfigService.decryptValue(encrypted);
    
    expect(encrypted).not.toBe(testValue);
    expect(decrypted).toBe(testValue);
  });
});
