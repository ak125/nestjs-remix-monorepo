/**
 * BuyingGuideDbService (R6) — RAG-provenance writes are refused before the served table.
 *
 * R6 buying-guide content is sourced from the decommissioned legacy RAG corpus
 * (ADR-031/046). The WriteGuard CAS on this service is a concurrency/ownership guard
 * that still writes — NOT a provenance gate. `upsertBuyingGuide()` refuses at method
 * entry when the payload is stamped `sgpg_source_type = RAG_LEGACY`, so RAG editorial
 * content never reaches `__seo_gamme_purchase_guide`. The QA-verdict metadata write
 * (no provenance stamp) is intentionally still allowed, to preserve observability.
 */
import { BuyingGuideDbService } from './buying-guide-db.service';
import { SOURCE_TIER } from '../../../../config/source-provenance.constants';
import type { ConfigService } from '@nestjs/config';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function makeR6(): BuyingGuideDbService {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  return new BuyingGuideDbService(config);
}

describe('BuyingGuideDbService (R6) — RAG-provenance writes refused', () => {
  it('refuses a RAG_LEGACY-stamped content payload — never touches the served table', async () => {
    const service = makeR6();

    // The refusal short-circuits at method entry, before the merge `.select()` and
    // the final `.update()` — the mocked client ({}) would throw if either ran.
    await expect(
      service.upsertBuyingGuide('123', {
        sgpg_source_type: SOURCE_TIER.RAG_LEGACY,
        sgpg_how_to_choose: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('does NOT refuse a QA-verdict metadata write (no provenance stamp) — guard is provenance-scoped', async () => {
    const service = makeR6();

    // No `sgpg_source_type` ⇒ the guard lets it through; it then reaches the mocked
    // client ({}) and throws — proving the refusal is provenance-scoped, not a blanket
    // block (the gatekeeper "RAG-incomplete" verdict must still be recorded).
    await expect(
      service.upsertBuyingGuide('123', { sgpg_gatekeeper_score: 10 }),
    ).rejects.toThrow();
  });
});
