import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { QualityHistoryController } from '../../../src/modules/seo-monitoring/controllers/quality-history.controller';
import { QualityHistorySnapshotService } from '../../../src/modules/seo-monitoring/services/quality-history-snapshot.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: jest.fn(), from: jest.fn() })),
}));

describe('QualityHistoryController', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.READ_ONLY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeConfig(overrides: Record<string, string | undefined>) {
    return {
      get: <T = string>(key: string): T | undefined => overrides[key] as T,
    } as unknown as ConfigService;
  }

  it('uses ANON_KEY when READ_ONLY=true and SERVICE_ROLE_KEY is absent', () => {
    process.env.READ_ONLY = 'true';
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';

    new QualityHistoryController(
      {} as QualityHistorySnapshotService,
      makeConfig({ SUPABASE_URL: 'https://supabase.test' }),
    );

    expect(createClient).toHaveBeenCalledWith(
      'https://supabase.test',
      'anon-key-xyz',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });
});
