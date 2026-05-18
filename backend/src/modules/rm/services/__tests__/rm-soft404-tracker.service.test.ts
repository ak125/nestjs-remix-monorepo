import { Test, TestingModule } from '@nestjs/testing';
import { RmSoft404TrackerService } from '../rm-soft404-tracker.service';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';

describe('RmSoft404TrackerService', () => {
  let service: RmSoft404TrackerService;
  let cache: jest.Mocked<Partial<CacheService>>;
  let supabaseInsert: jest.Mock;

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn() };
    supabaseInsert = jest.fn().mockResolvedValue({ error: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RmSoft404TrackerService,
        {
          provide: SupabaseBaseService,
          useValue: { client: { from: () => ({ insert: supabaseInsert }) } },
        },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get<RmSoft404TrackerService>(RmSoft404TrackerService);
  });

  it('classifie un UA Googlebot comme "bot"', () => {
    expect(
      service.classifyUA('Mozilla/5.0 (compatible; Googlebot/2.1; ...)'),
    ).toBe('bot');
  });
  it('classifie un UA Chrome comme "browser"', () => {
    expect(
      service.classifyUA(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('browser');
  });
  it('classifie un UA inconnu comme "unknown"', () => {
    expect(service.classifyUA('curl/8.5.0')).toBe('unknown');
  });
  it('classifie null ou empty comme "unknown"', () => {
    expect(service.classifyUA(null)).toBe('unknown');
    expect(service.classifyUA('')).toBe('unknown');
  });

  it('throttle: ne réinsère pas si la même session a déjà tracké < 60s', async () => {
    cache.get!.mockResolvedValue('1');
    await service.track(
      { pg_id: 3859, type_id: 11836 },
      { sessionId: 's1', ua: 'Mozilla/5.0 ... Chrome/120', referrer: null },
    );
    expect(supabaseInsert).not.toHaveBeenCalled();
  });

  it('insère sinon, et pose le flag Redis 60s', async () => {
    cache.get!.mockResolvedValue(null);
    await service.track(
      { pg_id: 3859, type_id: 11836 },
      {
        sessionId: 's2',
        ua: 'Mozilla/5.0 ... AppleWebKit Chrome/120',
        referrer: '/x',
      },
    );
    expect(supabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pg_id: 3859,
        type_id: 11836,
        ua_class: 'browser',
        referrer: '/x',
      }),
    );
    expect(cache.set).toHaveBeenCalledWith('track-soft-404:s2', '1', 60);
  });

  it('insère avec ua_class="bot" si UA Googlebot', async () => {
    cache.get!.mockResolvedValue(null);
    await service.track(
      { pg_id: 1, type_id: 2 },
      { sessionId: 'sb', ua: 'Googlebot/2.1', referrer: null },
    );
    expect(supabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ua_class: 'bot' }),
    );
  });
});
