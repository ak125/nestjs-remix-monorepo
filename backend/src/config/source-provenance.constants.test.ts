import {
  isLegacyRagTier,
  isSelfGrantedVerification,
  SOURCE_TIER,
} from './source-provenance.constants';

describe('isSelfGrantedVerification', () => {
  it.each(['rag', 'rag-legacy', ' RAG ', 'Rag-Legacy'])(
    'provenance RAG héritée (%s) → auto-attribuée, quel que soit le vérificateur',
    (tier) => {
      expect(isSelfGrantedVerification({ tier })).toBe(true);
      expect(
        isSelfGrantedVerification({ tier, verifiedBy: 'jean.dupont' }),
      ).toBe(true);
    },
  );

  it.each(['pipeline:rag-enrich', 'pipeline:rag-enrich-skipped', 'Pipeline:x'])(
    'vérificateur %s → auto-attribuée, quelle que soit la provenance',
    (verifiedBy) => {
      expect(
        isSelfGrantedVerification({ tier: SOURCE_TIER.WIKI, verifiedBy }),
      ).toBe(true);
      expect(isSelfGrantedVerification({ verifiedBy })).toBe(true);
    },
  );

  it.each([
    { tier: SOURCE_TIER.WIKI, verifiedBy: 'owner' },
    { tier: SOURCE_TIER.MANUAL, verifiedBy: null },
    { tier: 'pdf', verifiedBy: undefined },
    { tier: null, verifiedBy: '' },
    {},
  ])('provenance et vérificateur hors pipeline (%o) → non', (p) => {
    expect(isSelfGrantedVerification(p)).toBe(false);
  });

  it('ne change pas isLegacyRagTier', () => {
    expect(isLegacyRagTier('rag')).toBe(true);
    expect(isLegacyRagTier(SOURCE_TIER.RAG_LEGACY)).toBe(true);
    expect(isLegacyRagTier('wiki')).toBe(false);
    expect(isLegacyRagTier(null)).toBe(false);
  });
});
