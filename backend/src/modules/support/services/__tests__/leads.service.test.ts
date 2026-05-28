/**
 * Mini-CRM V0 — tests focalisés sur l'invariant métier critique :
 * la garde de transition (LEAD_TRANSITIONS) doit rejeter les changements
 * de statut interdits avant tout write Supabase.
 *
 * Les tests d'intégration end-to-end (filtre status, pagination, count)
 * sont délégués au smoke manuel (cf. verification section du plan).
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadsService } from '../leads.service';

type MockChain = {
  // Each operator returns the same chain stub so we can program a final result.
  select: jest.Mock;
  eq: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  lte: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  from: jest.Mock;
};

function makeSupabaseStub(finalResults: {
  maybeSingle?: { data: unknown; error: unknown };
  single?: { data: unknown; error: unknown };
  range?: { data: unknown; count: number | null; error: unknown };
}): { stub: MockChain; service: LeadsService } {
  const chain: MockChain = {
    select: jest.fn(),
    eq: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    lte: jest.fn(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    update: jest.fn(),
    from: jest.fn(),
  };

  // Every chained operator returns the chain itself except the terminal ones.
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);

  chain.maybeSingle.mockResolvedValue(
    finalResults.maybeSingle ?? { data: null, error: null },
  );
  chain.single.mockResolvedValue(
    finalResults.single ?? { data: null, error: null },
  );
  chain.range.mockResolvedValue(
    finalResults.range ?? { data: [], count: 0, error: null },
  );

  // LeadsService extends SupabaseBaseService — we instantiate the subclass
  // without calling the base constructor's config wiring by patching the
  // supabase property directly via Object.defineProperty.
  const service = Object.create(LeadsService.prototype) as LeadsService;
  Object.defineProperty(service, 'supabase', { value: chain, writable: false });
  Object.defineProperty(service, 'logger', {
    value: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
    writable: false,
  });

  return { stub: chain, service };
}

describe('LeadsService', () => {
  describe('updateLeadStatus — transition guard', () => {
    it('rejects invalid transition new → won with BadRequestException', async () => {
      const { service } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
      });

      await expect(
        service.updateLeadStatus('42', 'won', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts valid transition new → contacted', async () => {
      const { service, stub } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
        single: {
          data: { msg_id: '42', msg_crm_status: 'contacted' },
          error: null,
        },
      });

      const result = await service.updateLeadStatus(
        '42',
        'contacted',
        'user-1',
      );
      expect(result.msg_crm_status).toBe('contacted');
      expect(stub.update).toHaveBeenCalledWith({ msg_crm_status: 'contacted' });
    });

    it('rejects transition from terminal "won" state', async () => {
      const { service } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'won' },
          error: null,
        },
      });

      await expect(
        service.updateLeadStatus('42', 'lost', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows recycling lost → new', async () => {
      const { service } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'lost' },
          error: null,
        },
        single: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
      });

      const result = await service.updateLeadStatus('42', 'new', 'user-1');
      expect(result.msg_crm_status).toBe('new');
    });

    it('throws NotFoundException when lead is not CRM-tracked (NULL status)', async () => {
      const { service } = makeSupabaseStub({
        maybeSingle: { data: null, error: null },
      });

      await expect(
        service.updateLeadStatus('999', 'contacted', null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateLeadFields — strict guard', () => {
    it('rejects empty payload as BadRequest (pas de no-op silencieux)', async () => {
      const { service } = makeSupabaseStub({});
      await expect(service.updateLeadFields('42', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('writes only declared fields (no PATCH leakage)', async () => {
      const { service, stub } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
        single: {
          data: {
            msg_id: '42',
            msg_crm_status: 'new',
            msg_crm_internal_note: 'foo',
          },
          error: null,
        },
      });

      await service.updateLeadFields('42', { internal_note: 'foo' });
      expect(stub.update).toHaveBeenCalledWith({
        msg_crm_internal_note: 'foo',
      });
    });

    it('preserves explicit null (clear the field)', async () => {
      const { service, stub } = makeSupabaseStub({
        maybeSingle: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
        single: {
          data: { msg_id: '42', msg_crm_status: 'new' },
          error: null,
        },
      });

      await service.updateLeadFields('42', { next_follow_up_at: null });
      expect(stub.update).toHaveBeenCalledWith({
        msg_crm_next_follow_up_at: null,
      });
    });
  });

  describe('listLeads — pagination + filters', () => {
    it('always filters out NULL msg_crm_status (legacy rows excluded)', async () => {
      const { service, stub } = makeSupabaseStub({
        range: { data: [], count: 0, error: null },
      });

      await service.listLeads({ page: 1, page_size: 50 });

      // The first .not() call after .select() must target msg_crm_status IS NULL.
      expect(stub.not).toHaveBeenCalledWith('msg_crm_status', 'is', null);
    });

    it('translates pagination to .range with inclusive bounds', async () => {
      const { service, stub } = makeSupabaseStub({
        range: { data: [], count: 100, error: null },
      });

      await service.listLeads({ page: 2, page_size: 50 });

      // page=2, page_size=50 → from=50, to=99
      expect(stub.range).toHaveBeenCalledWith(50, 99);
    });

    it('returns total count from supabase exact count', async () => {
      const { service } = makeSupabaseStub({
        range: { data: [{ msg_id: '1' }], count: 137, error: null },
      });

      const result = await service.listLeads({ page: 1, page_size: 50 });
      expect(result.total).toBe(137);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(50);
    });
  });
});
