import { createClient } from '@supabase/supabase-js';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';
import { resolveTemplate } from '../../src/modules/media-factory/render/templates/template-registry';
import { ConfigService } from '@nestjs/config';

function setup(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 1,
    brief_id: 'synthetic-template',
    video_type: 'short',
    status: 'draft',
    approval_record: null,
    template_id: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
  const chain: Record<string, jest.Mock> = {};
  for (const key of ['from', 'select', 'update', 'eq', 'is'])
    chain[key] = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: row, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: { ...row, template_id: 'short-braking-fact' },
    error: null,
  });
  chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
  chain.order = jest.fn().mockResolvedValue({ data: [], error: null });
  const service = new VideoDataService(
    new ConfigService({
      SUPABASE_URL: 'https://synthetic.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only',
    }),
  );
  Object.defineProperty(service, 'client', { get: () => chain });
  return { service, chain, row };
}
const selection = {
  templateId: 'short-braking-fact',
  expectedUpdatedAt: '2026-01-01T00:00:00Z',
};
describe('template selection through production update', () => {
  it('persists the registry identifier using optimistic concurrency', async () => {
    const { service, chain } = setup();
    const result = await service.updateProduction(
      'synthetic-template',
      selection,
    );
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: 'short-braking-fact' }),
    );
    expect(chain.eq).toHaveBeenCalledWith(
      'updated_at',
      selection.expectedUpdatedAt,
    );
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
    expect(chain.is).toHaveBeenCalledWith('approval_record', null);
    expect(result.templateId).toBe('short-braking-fact');
    expect(resolveTemplate(result.templateId).compositionId).toBe(
      'ShortBrakingFact',
    );
  });
  it.each(['unknown', '', 'constructor', null, 4])(
    'rejects invalid identifier %s without writing',
    async (templateId) => {
      const { service, chain } = setup();
      await expect(
        service.updateProduction('synthetic-template', {
          ...selection,
          templateId,
        } as never),
      ).rejects.toThrow();
      expect(chain.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    { video_type: 'film_socle' },
    { status: 'ready_for_publish' },
    { approval_record: { stages: [] } },
    { updated_at: '2026-01-02T00:00:00Z' },
  ])('preserves incompatible or reviewed production %j', async (overrides) => {
    const { service, chain } = setup(overrides);
    await expect(
      service.updateProduction('synthetic-template', selection),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('refuses selection once an execution exists', async () => {
    const { service, chain } = setup();
    chain.limit.mockResolvedValue({ data: [{ id: 1 }], error: null });
    await expect(
      service.updateProduction('synthetic-template', selection),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('does not treat unavailable execution history as empty', async () => {
    const { service, chain } = setup();
    chain.limit.mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    await expect(
      service.updateProduction('synthetic-template', selection),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('rejects stale concurrent writes', async () => {
    const { service, chain } = setup();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      service.updateProduction('synthetic-template', selection),
    ).rejects.toThrow();
  });
  it('rejects an approval bundled with the template', async () => {
    const { service, chain } = setup();
    await expect(
      service.updateProduction('synthetic-template', {
        ...selection,
        approvalRecord: { briefId: 'synthetic-template', stages: [] },
      }),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('lists registered choices even when database metadata is incomplete', async () => {
    const { service, chain } = setup();
    chain.order.mockResolvedValue({
      data: [{ template_id: 'db-only', structure: { compositionId: 'Wrong' } }],
      error: null,
    });
    const templates = await service.listTemplates();
    expect(templates.map((t) => t.templateId)).toEqual([
      'test-card',
      'short-product-highlight',
      'short-braking-fact',
      'db-only',
    ]);
    expect(templates[3].structure.supportedVideoTypes).toEqual([]);
    expect(templates[0].structure.supportedVideoTypes).toEqual([
      'short',
      'film_gamme',
      'film_socle',
    ]);
  });
});

describe('template selection failures and catalog provenance', () => {
  it.each([undefined, null, '', 42])(
    'requires a version %s before writing',
    async (expectedUpdatedAt) => {
      const { service, chain } = setup();
      await expect(
        service.updateProduction('synthetic-template', {
          ...selection,
          expectedUpdatedAt,
        } as never),
      ).rejects.toThrow();
      expect(chain.update).not.toHaveBeenCalled();
    },
  );
  it('surfaces persistence failure as unavailability', async () => {
    const { service, chain } = setup();
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    await expect(
      service.updateProduction('synthetic-template', selection),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('keeps metadata but cannot override composition or format support from the registry', async () => {
    const { service, chain } = setup();
    chain.order.mockResolvedValue({
      data: [
        {
          id: 99,
          template_id: 'short-braking-fact',
          version: 4,
          video_type: 'film_socle',
          platform: 'youtube',
          allowed_use_cases: ['synthetic'],
          forbidden_use_cases: ['demo'],
          duration_range: { min: 1, max: 20 },
          structure: {
            compositionId: 'Wrong',
            supportedVideoTypes: ['film_socle'],
            note: 'metadata',
          },
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const template = (await service.listTemplates()).find(
      (t) => t.templateId === 'short-braking-fact',
    );
    expect(template).toMatchObject({
      id: 99,
      version: 4,
      platform: 'youtube',
      videoType: 'short',
      structure: {
        compositionId: 'ShortBrakingFact',
        supportedVideoTypes: ['short'],
        note: 'metadata',
        source: 'code_registry',
      },
    });
  });
  it('still exposes executable registry choices when metadata is unavailable', async () => {
    const { service, chain } = setup();
    chain.order.mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    expect(await service.listTemplates()).toHaveLength(3);
  });
});

it('sends a conditional PATCH through the installed Supabase client without network access', async () => {
  const requests: Array<{ url: URL; method: string; body: unknown }> = [];
  const row = {
    id: 1,
    brief_id: 'synthetic-template',
    video_type: 'short',
    status: 'draft',
    approval_record: null,
    template_id: null,
    updated_at: selection.expectedUpdatedAt,
  };
  const client = createClient(
    'https://synthetic.invalid',
    'synthetic-test-only',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          const method = init?.method ?? 'GET';
          requests.push({
            url,
            method,
            body: init?.body ? JSON.parse(String(init.body)) : null,
          });
          return new Response(
            JSON.stringify(
              url.pathname.endsWith('__video_execution_log')
                ? []
                : {
                    ...row,
                    template_id:
                      method === 'PATCH' ? selection.templateId : null,
                  },
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      },
    },
  );
  const service = new VideoDataService(
    new ConfigService({
      SUPABASE_URL: 'https://synthetic.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only',
    }),
  );
  Object.defineProperty(service, 'client', { get: () => client });
  expect(
    (await service.updateProduction(row.brief_id, selection)).templateId,
  ).toBe(selection.templateId);
  const patch = requests.find((request) => request.method === 'PATCH')!;
  expect(patch.url.pathname).toBe('/rest/v1/__video_productions');
  expect(Object.fromEntries(patch.url.searchParams)).toMatchObject({
    brief_id: 'eq.synthetic-template',
    updated_at: 'eq.' + selection.expectedUpdatedAt,
    status: 'eq.draft',
    approval_record: 'is.null',
  });
  expect(patch.body).toMatchObject({ template_id: 'short-braking-fact' });
  expect(requests).toHaveLength(3);
});
