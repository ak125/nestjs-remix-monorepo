import { RagEnrichmentEngine } from './rag-enrichment.engine';
import type { RagProxyService } from '../../rag-proxy/rag-proxy.service';

const content = 'Verifier la fixation selon la procedure documentee.';
const source = 'diagnostic/fixture.md';
const enrich = async (results: unknown[]) => {
  const search = jest.fn().mockResolvedValue({ results });
  const engine = new RagEnrichmentEngine({
    search,
  } as unknown as RagProxyService);
  const facts = await engine.enrich('freinage', ['bruit'], []);
  return { facts, search };
};

describe('Diagnostic RAG evidence admission', () => {
  it.each(['L1', 'L2'])(
    'preserves a documented %s fact and requests role R5',
    async (truth_level) => {
      const { facts, search } = await enrich([
        { content, source_path: source, truth_level },
      ]);
      expect(facts).toEqual([
        {
          content,
          source_file: source,
          truth_level,
          evidence_type: 'verification_support_evidence',
        },
      ]);
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { truth_levels: ['L1', 'L2'] },
          routing: { target_role: 'R5_DIAGNOSTIC' },
        }),
      );
    },
  );

  it.each([undefined, null, '', 'L3', 'L4', 'invented'])(
    'does not promote an absent or inadmissible truth level (%s) to evidence',
    async (truth_level) => {
      expect(
        (await enrich([{ content, sourcePath: source, truth_level }])).facts,
      ).toEqual([]);
    },
  );

  it.each([undefined, '', '   ', 'unknown'])(
    'does not invent traceability for source %s',
    async (sourcePath) => {
      expect(
        (await enrich([{ content, sourcePath, truth_level: 'L1' }])).facts,
      ).toEqual([]);
    },
  );

  it('skips malformed chunks without losing a following admissible fact', async () => {
    const { facts } = await enrich([
      { content: null, sourcePath: source, truth_level: 'L1' },
      { content, sourcePath: source, truth_level: 'L2' },
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].truth_level).toBe('L2');
  });

  it('deduplicates and caps admissible facts at ten', async () => {
    const contents = Array.from(
      { length: 14 },
      (_, i) => `Verifier le point documente numero ${i}.`,
    );
    const { facts } = await enrich([
      {
        content: [...contents, ...contents].join('\n'),
        sourcePath: source,
        truth_level: 'L1',
      },
    ]);
    expect(facts).toHaveLength(10);
    expect(facts.map((f) => f.content)).toEqual(contents.slice(0, 10));
  });

  it('keeps graceful degradation when the RAG service is unavailable', async () => {
    expect(
      await new RagEnrichmentEngine(null).enrich('freinage', [], []),
    ).toEqual([]);
  });
});
