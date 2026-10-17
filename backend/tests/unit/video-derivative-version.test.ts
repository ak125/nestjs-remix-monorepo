import { ConfigService } from '@nestjs/config';
import { DerivativeEngineService } from '../../src/modules/media-factory/services/derivative-engine.service';
const version = '2026-10-14T10:00:00Z';
describe('derivative source revision', () => {
  let service: DerivativeEngineService;
  let chain: Record<string, jest.Mock>;
  beforeEach(() => {
    const master = {
      id: 1,
      briefId: 'master',
      updatedAt: version,
      status: 'draft',
      contentRole: 'master_truth',
      claimTable: [
        { id: 'claim', status: 'verified', rawText: 'Narration source' },
      ],
      knowledgeContract: { existing: 'retained' },
    };
    service = new DerivativeEngineService(
      {
        get: (k: string) =>
          k === 'SUPABASE_URL' ? 'https://unit.invalid' : 'unit-key',
      } as ConfigService,
      { getProduction: jest.fn().mockResolvedValue(master) } as never,
    );
    chain = {};
    for (const name of ['from', 'select', 'eq', 'insert', 'update'])
      chain[name] = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 1 }, error: null });
    chain.single = jest
      .fn()
      .mockResolvedValue({ data: { id: 2 }, error: null });
    chain.then = jest.fn((resolve) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );
    Object.defineProperty(service, 'client', { get: () => chain });
  });
  it('refuses an old parent revision before creating any derivative', async () => {
    await expect(
      service.deriveFromMaster('master', undefined, '2026-10-13T00:00:00Z'),
    ).rejects.toMatchObject({ status: 409 });
    expect(chain.insert).not.toHaveBeenCalled();
  });
  it('rejects a concurrent parent edit before inserting children', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      service.deriveFromMaster('master', undefined, version),
    ).rejects.toMatchObject({ status: 409 });
    expect(chain.insert).not.toHaveBeenCalled();
  });
  it('pins the source version and claim in the derivative snapshot', async () => {
    await service.deriveFromMaster('master', undefined, version);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledge_contract: {
          existing: 'retained',
          derivativeSource: {
            briefId: 'master',
            productionVersion: version,
            claimId: 'claim',
          },
        },
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith('updated_at', version);
  });
});
