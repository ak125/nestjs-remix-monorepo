/**
 * PriceImportService — commit stamps the tariff's real supplier and date.
 *
 * Constat du 2026-11-17 (mandat AS) : pricing_commit_chunk n'écrivait ni
 * pri_frs ni pri_date_from, et la charge utile du commit ne les portait pas.
 * Ces tests fixent le contrat côté TS : chaque ligne envoyée porte `frs` et
 * `date_from`, et un commit sans date de tarif ou sans fournisseur connu est
 * refusé avant toute écriture (pas de valeur par défaut).
 */
import { BadRequestException } from '@nestjs/common';
import {
  PriceImportService,
  buildCommitPayloads,
  toPriDateFrom,
  type ImportRequest,
} from './price-import.service';
import type { DryRunReport, ImportLine } from './price-import.dry-run';
import type { PricingRepository } from './pricing.repository';
import type { SupplierTruthRepository } from '../../supplier-truth/supplier-truth.repository';

const line = (key: string, achatHtCents: number): ImportLine => ({
  key,
  matchedBy: 'REF',
  achatHtCents,
  confidence: 'HIGH_CONFIDENCE',
  derivation: 'DIRECT_NET',
});

const row = (over: Record<string, unknown>) =>
  ({
    key: 'A1',
    priPieceIdI: 101,
    matched: true,
    operation: 'UPDATE',
    appliedMargePct: 40,
    newVenteHtCents: 1400,
    newVenteTtcCents: 1680,
    rejected: false,
    skippedState: null,
    ...over,
  }) as unknown as DryRunReport['rows'][number];

const report = (rows: DryRunReport['rows']): DryRunReport =>
  ({ rows }) as unknown as DryRunReport;

describe('toPriDateFrom', () => {
  it('formats a tariff date like the historical pri_date_from values', () => {
    expect(toPriDateFrom('2026-11-01')).toBe('2026-11-01T00:00:00.000Z');
  });

  it.each([undefined, '', '01/11/2026', '2026-11-1', '2026-02-30'])(
    'refuses %p (no invented date)',
    (value) => {
      expect(() => toPriDateFrom(value)).toThrow(BadRequestException);
    },
  );
});

describe('buildCommitPayloads', () => {
  const stamp = { frs: 'DCA', dateFrom: '2026-11-01T00:00:00.000Z' };

  it('stamps every committed row with the real supplier and the tariff date', () => {
    const lines = new Map([
      ['A1', line('A1', 1000)],
      ['B2', line('B2', 500)],
    ]);
    const payloads = buildCommitPayloads(
      report([
        row({ key: 'A1' }),
        row({ key: 'B2', priPieceIdI: 202, operation: 'INSERT' }),
      ]),
      lines,
      '4200',
      stamp,
    );
    expect(payloads).toHaveLength(2);
    for (const p of payloads) {
      expect(p.frs).toBe('DCA');
      expect(p.date_from).toBe('2026-11-01T00:00:00.000Z');
      expect(p.pm_id).toBe('4200');
    }
    expect(payloads[0]).toMatchObject({
      piece_id_i: 101,
      operation: 'UPDATE',
      achat_ht: 10,
      vente_ht: 14,
      vente_ttc: 16.8,
    });
  });

  it('leaves out rejected, unmatched and state-skipped rows (they are not written)', () => {
    const lines = new Map([['A1', line('A1', 1000)]]);
    const payloads = buildCommitPayloads(
      report([
        row({ rejected: true }),
        row({ matched: false }),
        row({ skippedState: 'FROZEN' }),
        row({ key: 'UNKNOWN' }),
      ]),
      lines,
      '4200',
      stamp,
    );
    expect(payloads).toEqual([]);
  });
});

describe('PriceImportService.commit', () => {
  const baseReq: ImportRequest = {
    supplierId: '71',
    brandPmId: '4200',
    fileRows: [{ ref: 'A1', achat_ht: '10.00' }],
    operator: 'test',
  };

  function makeRepo(_label?: string | null) {
    return {
      setBatchStatus: jest.fn().mockResolvedValue(undefined),
      createChunk: jest.fn().mockResolvedValue('chunk-1'),
      commitChunk: jest
        .fn()
        .mockResolvedValue({ committed: 1, skipped: 0, missing: 0 }),
    };
  }

  function makeSupplierTruth(label: string | null) {
    const directory = new Map<string, { splId: string; nom: string }>([
      ['CAL', { splId: '19', nom: 'CAL' }],
    ]);
    if (label) directory.set(label, { splId: '71', nom: label });
    return {
      getSupplierDirectory: jest.fn().mockResolvedValue(directory),
    };
  }

  function makeService(
    repo: ReturnType<typeof makeRepo>,
    label: string | null = 'DCA',
  ) {
    const svc = new PriceImportService(
      repo as unknown as PricingRepository,
      makeSupplierTruth(label) as unknown as SupplierTruthRepository,
    );
    jest
      .spyOn(svc as never, 'buildLines' as never)
      .mockResolvedValue([line('A1', 1000)] as never);
    jest
      .spyOn(svc as never, 'computeReport' as never)
      .mockResolvedValue(report([row({})]) as never);
    return svc;
  }

  it('refuses a commit without tariffDate before any write', async () => {
    const repo = makeRepo('DCA');
    await expect(makeService(repo).commit('batch-1', baseReq)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.setBatchStatus).not.toHaveBeenCalled();
    expect(repo.commitChunk).not.toHaveBeenCalled();
  });

  it('refuses a commit whose supplier has no label, before any write', async () => {
    const repo = makeRepo(null);
    await expect(
      makeService(repo, null).commit('batch-1', {
        ...baseReq,
        tariffDate: '2026-11-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.setBatchStatus).not.toHaveBeenCalled();
    expect(repo.commitChunk).not.toHaveBeenCalled();
  });

  it('sends the supplier label and tariff date with each row to pricing_commit_chunk', async () => {
    const repo = makeRepo('DCA');
    await makeService(repo).commit('batch-1', {
      ...baseReq,
      tariffDate: '2026-11-01',
    });
    expect(repo.commitChunk).toHaveBeenCalledTimes(1);
    const sent = repo.commitChunk.mock.calls[0][0];
    expect(sent.supplier).toBe('71');
    expect(sent.activate).toBe(false);
    expect(sent.rows).toEqual([
      expect.objectContaining({
        piece_id_i: 101,
        frs: 'DCA',
        date_from: '2026-11-01T00:00:00.000Z',
      }),
    ]);
  });
});
