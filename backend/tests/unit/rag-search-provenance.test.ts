import { SearchResponseSchema } from '../../src/modules/rag-proxy/dto/search.dto';

const provenance = {
  content_hash: 'indexed-source-hash',
  canonical_source: 'automecanik-wiki',
  source_layer: 'exports/rag',
  source_commit: 'fixture-wiki-commit',
  lineage_id: 'fixture-import-batch',
  embedding_model: 'fixture-model',
  origin_batch_kind: 'wiki_import',
};

const response = (metadata: Record<string, unknown>) => ({
  query: 'fixture query',
  total: 1,
  results: [{ title: 'Fixture', content: 'Preview...', score: 0.9, ...metadata }],
});

describe('RAG search provenance contract', () => {
  it('preserves indexed hash and lineage through response validation', () => {
    const parsed = SearchResponseSchema.parse(response(provenance));
    expect(parsed.results[0]).toEqual(expect.objectContaining(provenance));
  });

  it('accepts historical API responses without inventing provenance', () => {
    const parsed = SearchResponseSchema.parse(response({}));
    expect(parsed.results[0]).not.toHaveProperty('canonical_source');
    expect(parsed.results[0]).not.toHaveProperty('content_hash');
  });

  it('preserves explicit unknown provenance returned for legacy chunks', () => {
    const unknown = {
      content_hash: '',
      canonical_source: null,
      source_layer: null,
      source_commit: null,
      lineage_id: null,
      embedding_model: null,
      origin_batch_kind: null,
    };
    const parsed = SearchResponseSchema.parse(response(unknown));
    expect(parsed.results[0]).toEqual(expect.objectContaining(unknown));
  });
});
