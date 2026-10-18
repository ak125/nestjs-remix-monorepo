import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { UserDataConsolidatedService } from './user-data-consolidated.service';

// Exercise the real data methods; only the transport response is supplied by the fixture.
describe.each(['findAdminById', 'findById'] as const)(
  '%s identity lookup',
  (method) => {
    let service: UserDataConsolidatedService;
    let result: jest.Mock;
    beforeEach(() => {
      result = jest.fn();
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: result,
        maybeSingle: result,
      };
      service = Object.create(UserDataConsolidatedService.prototype);
      Object.defineProperties(service, {
        supabase: { value: { from: jest.fn().mockReturnValue(query) } },
        logger: { value: new Logger('IdentityAvailabilityTest') },
      });
    });

    it('returns null only for a successful empty result', async () => {
      result.mockResolvedValue({ data: null, error: null });
      await expect(service[method]('missing')).resolves.toBeNull();
    });

    it.each([
      { code: 'PGRST000', message: 'connection unavailable' },
      { code: 'PGRST116', message: 'multiple identity rows' },
      { code: '42501', message: 'permission denied' },
    ])(
      'propagates query failure $code as availability failure',
      async (error) => {
        result.mockResolvedValue({ data: null, error });
        await expect(service[method]('fixture')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
      },
    );

    it('propagates rejected transport requests', async () => {
      result.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service[method]('fixture')).rejects.toMatchObject({
        status: 503,
      });
    });

    it('keeps valid identity mapping', async () => {
      const row =
        method === 'findAdminById'
          ? {
              cnfa_id: 'fixture',
              cnfa_mail: 'admin@example.invalid',
              cnfa_level: '7',
              cnfa_activ: '1',
            }
          : {
              cst_id: 'fixture',
              cst_mail: 'member@example.invalid',
              cst_level: '9',
              cst_activ: '1',
            };
      result.mockResolvedValue({ data: row, error: null });
      await expect(service[method]('fixture')).resolves.toMatchObject({
        id: 'fixture',
        isActive: true,
      });
    });
  },
);
