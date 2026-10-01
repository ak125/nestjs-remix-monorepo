import { createClient } from '@supabase/supabase-js';
import { MarketingBriefsService } from '../../src/modules/marketing/services/marketing-briefs.service';
import { BrandComplianceGateService } from '../../src/modules/marketing/services/brand-compliance-gate.service';
import { MarketingHubDataService } from '../../src/modules/marketing/services/marketing-hub-data.service';
import { RpcGateService } from '../../src/security/rpc-gate/rpc-gate.service';

jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {},
}));

describe('Marketing brief PostgREST query contract', () => {
  const brief = {
    id: 'brief-1',
    status: 'draft',
    updated_at: '2026-10-01T12:00:00.123456+00:00',
    agent_id: 'customer-retention-agent',
    business_unit: 'ECOMMERCE',
    channel: 'email',
    conversion_goal: 'ORDER',
    cta: 'Commander',
    target_segment: 'test',
    payload: {},
    coverage_manifest: {
      scope_requested: 'test',
      final_status: 'REVIEW_REQUIRED',
    },
    brand_gate_level: 'PASS',
    compliance_gate_level: 'PASS',
    gate_summary: null,
  };

  it.each([false, true])(
    'uses the actual client and CAS filters (conflict=%s)',
    async (conflict) => {
      const calls: Array<{ url: URL; method: string; body: unknown }> = [];
      // No real network: inspect the request produced by the installed supabase-js.
      const client = createClient('https://supabase.invalid', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input, init) => {
            const method = init?.method ?? 'GET';
            const body = init?.body ? JSON.parse(String(init.body)) : null;
            calls.push({ url: new URL(String(input)), method, body });
            return new Response(
              JSON.stringify(
                method === 'GET'
                  ? [brief]
                  : conflict
                    ? []
                    : [{ ...brief, ...body }],
              ),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          },
        },
      });
      const service = new MarketingBriefsService(
        {} as RpcGateService,
        new BrandComplianceGateService({} as MarketingHubDataService),
      );
      Object.defineProperty(service, 'supabase', { value: client });
      const result = service.updateBriefStatus(
        'brief-1',
        'reviewed',
        'admin@example.test',
      );
      if (conflict) await expect(result).rejects.toMatchObject({ status: 409 });
      else
        await expect(result).resolves.toMatchObject({
          status: 'reviewed',
          reviewed_by: 'admin@example.test',
        });
      expect(calls).toHaveLength(2);
      const write = calls[1];
      expect(write.method).toBe('PATCH');
      expect(write.url.pathname).toBe('/rest/v1/__marketing_brief');
      expect(Object.fromEntries(write.url.searchParams)).toEqual({
        id: 'eq.brief-1',
        status: 'eq.draft',
        updated_at: 'eq.2026-10-01T12:00:00.123456+00:00',
        select: '*',
      });
      expect(write.body).toEqual({
        status: 'reviewed',
        reviewed_by: 'admin@example.test',
        reviewed_at: expect.any(String),
      });
    },
  );
});
