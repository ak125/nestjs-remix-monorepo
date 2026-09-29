import { ConfigService } from '@nestjs/config';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { R2EnricherService } from './r2-enricher.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(
    () =>
      'selection_criteria:\n- fixture selection\nanti_mistakes:\n- fixture caution\nfaq:\n- fixture question',
  ),
}));

describe('R2 public enrichment refuses legacy RAG at the real write gate', () => {
  it.each([true, false])(
    'returns a refusal and zero DB writes with writeGuardEnabled=%s',
    async (enabled) => {
      const gate = new ContentWriteGateService(
        { get: () => 'http://127.0.0.1:9' } as unknown as ConfigService,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { writeGuardEnabled: enabled } as never,
      );
      const writes: string[] = [];
      const from = jest.fn((table: string) => {
        if (table === 'pieces_gamme') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    pg_id: '7',
                    pg_name: 'Filtre à huile',
                    pg_alias: 'filtre-a-huile',
                    pg_parent: '1',
                    pg_level: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          upsert: async () => {
            writes.push(table);
            return { error: null };
          },
        };
      });
      const svc = Object.create(
        R2EnricherService.prototype,
      ) as R2EnricherService;
      Object.assign(svc, {
        writeGate: gate,
        RAG_GAMMES_DIR: '/unused-fixture',
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      });
      Object.defineProperty(svc, 'client', { value: { from } });

      const result = await svc.enrichSingle(
        '7',
        'filtre-a-huile',
        'fixture-vehicle',
      );

      expect(result).toMatchObject({
        status: 'skipped',
        phase: 'write',
        sectionsGenerated: 3,
        errorMessage: 'rag_provenance_refused',
      });
      expect(result.qualityFlags).toContain('RAG_SOURCE_REFUSED');
      expect(writes).toEqual([]);
      expect(from.mock.calls.map(([table]) => table)).toEqual(['pieces_gamme']);
    },
  );
});
