import { GammeResponseBuilderService } from '../../src/modules/gamme-rest/services/gamme-response-builder.service';

describe('GammeResponseBuilderService buying guide fallback', () => {
  const makeBaseRpcPayload = () => ({
    pageData: {
      pg_name: 'Disque de frein',
      pg_name_meta: 'Disque de frein',
      pg_alias: 'disque-de-frein',
      pg_relfollow: '1',
      pg_level: '1',
      pg_img: null,
      pg_wall: null,
    },
    aggregatedData: {
      seo: null,
      conseils: [],
      informations: [],
      equipementiers: [],
      blog: null,
      catalogue_famille: [],
      famille_info: {
        mf_id: 1,
        mf_name: 'Freinage',
        mf_pic: 'freinage.svg',
      },
      motorisations_enriched: [],
      seo_fragments_1: [],
      seo_fragments_2: [],
      cgc_level_stats: {
        level_1: 0,
        level_2: 0,
        level_3: 0,
        level_5: 0,
        total: 0,
      },
      motorisations_blog: [],
      seo_validation: {
        family_count: 1,
        gamme_count: 1,
      },
    },
    timings: {
      rpcTime: 11,
    },
  });

  const makeTransformerMock = () =>
    ({
      contentCleaner: jest.fn((value) => String(value || '')),
      generateDefaultSeo: jest.fn(() => ({
        title: 'Titre défaut',
        description: 'Description défaut',
        keywords: 'mots-clés',
        h1: 'H1 par défaut',
        content: 'Contenu SEO par défaut',
      })),
      processConseils: jest.fn(() => []),
      processInformations: jest.fn(() => []),
      processCatalogueFamille: jest.fn(() => []),
      processEquipementiers: jest.fn(() => []),
      cleanSeoText: jest.fn((value) => String(value || '')),
    }) as any;

  const makeRpcServiceMock = () =>
    ({
      getPageDataRpcV2: jest.fn(async () => makeBaseRpcPayload()),
      getSeoFragmentsByTypeId: jest.fn(() => ({ fragment1: '', fragment2: '' })),
    }) as any;

  const makeAutoGuide = () => ({
    id: 479,
    pgId: '479',
    inputs: {
      vehicle: 'Identifier via VIN',
      position: 'Avant',
      dimensionsOrReference: 'Diametre et epaisseur',
      discType: 'Ventile',
      constraints: ['Jante', 'Etrier'],
    },
    decisionTree: [
      {
        id: 'vehicle',
        question: 'Vehicule identifie ?',
        options: [{ label: 'Oui', outcome: 'continue' }],
      },
    ],
    compatibilityRules: [
      'Verifier la compatibilite exacte avec le vehicule.',
      "Verifier les dimensions et la reference d'origine.",
      'Valider les contraintes de montage avant commande.',
    ],
    antiMistakes: ['Toujours verifier la reference avant achat.'],
    selectionCriteria: [
      {
        key: 'diameter',
        label: 'Diametre',
        guidance: 'Respecter la cote constructeur.',
        priority: 'required',
      },
      {
        key: 'thickness',
        label: 'Epaisseur',
        guidance: "Respecter l'epaisseur nominale.",
        priority: 'required',
      },
      {
        key: 'type',
        label: 'Type',
        guidance: "Respecter la monte d'origine.",
        priority: 'required',
      },
    ],
    useCases: [
      { id: 'city', label: 'Ville', recommendation: 'Usage quotidien.' },
      { id: 'road', label: 'Route', recommendation: 'Usage polyvalent.' },
      { id: 'mountain', label: 'Montagne', recommendation: 'Usage thermique.' },
    ],
    pairing: {
      required: [],
      recommended: [],
      checks: [],
    },
    output: {
      selectedSpec: 'Spec disque compatible',
      pairingAdvice: ['Changer par paire'],
      warnings: ['Verifier cotes avant commande'],
    },
    faq: [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
      { question: 'Q3', answer: 'A3' },
    ],
    symptoms: [],
    trustArguments: [],
    quality: {
      score: 95,
      flags: [],
      version: 'GammeBuyingGuide.v1' as const,
      source: 'manual://automecanik/template#pg=479',
      verified: true,
    },
  });

  it('utilise le fallback auto quand aucun contrat guide n est disponible', async () => {
    const transformer = makeTransformerMock();
    const rpcService = makeRpcServiceMock();
    const autoGuide = makeAutoGuide();
    const buyingGuideService = {
      getBuyingGuideContractV1: jest.fn(async () => null),
      toBuyingGuideV1: jest.fn(),
      passesBuyingGuideAntiWikiGate: jest.fn(() => ({
        ok: false,
        reasons: ['MISSING_GUIDE'],
      })),
      buildAutoBuyingGuideV1: jest.fn(() => autoGuide),
    } as any;

    const service = new GammeResponseBuilderService(
      transformer,
      rpcService,
      buyingGuideService,
    );

    const result = await service.buildRpcV2Response('479');

    expect(buyingGuideService.getBuyingGuideContractV1).toHaveBeenCalledWith('479');
    expect(buyingGuideService.toBuyingGuideV1).not.toHaveBeenCalled();
    expect(buyingGuideService.buildAutoBuyingGuideV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pgId: '479',
        pgName: 'Disque de frein',
        familyName: 'Freinage',
      }),
    );

    expect(result.hero.h1).toBe('H1 par défaut');
    expect(result.gammeBuyingGuide).toEqual(autoGuide);
    expect(result.performance.buying_guide_available).toBe(1);
    expect(result.performance.buying_guide_fallback_used).toBe(1);
    expect(result.performance.buying_guide_gate_ok).toBe(0);
    expect(result.performance).not.toHaveProperty('purchase_guide_v2_available');
  });

  it('utilise le contrat guide DB quand il existe', async () => {
    const transformer = makeTransformerMock();
    const rpcService = makeRpcServiceMock();
    const dbContract = { id: 479, pgId: '479' };
    const mappedGuide = makeAutoGuide();

    const buyingGuideService = {
      getBuyingGuideContractV1: jest.fn(async () => dbContract),
      toBuyingGuideV1: jest.fn(() => mappedGuide),
      passesBuyingGuideAntiWikiGate: jest.fn(() => ({
        ok: true,
        reasons: [],
      })),
      buildAutoBuyingGuideV1: jest.fn(),
    } as any;

    const service = new GammeResponseBuilderService(
      transformer,
      rpcService,
      buyingGuideService,
    );

    const result = await service.buildRpcV2Response('479');

    expect(buyingGuideService.getBuyingGuideContractV1).toHaveBeenCalledWith('479');
    expect(buyingGuideService.toBuyingGuideV1).toHaveBeenCalledWith(dbContract);
    expect(buyingGuideService.passesBuyingGuideAntiWikiGate).toHaveBeenCalledWith(
      mappedGuide,
    );
    expect(buyingGuideService.buildAutoBuyingGuideV1).not.toHaveBeenCalled();
    expect(result.gammeBuyingGuide).toEqual(mappedGuide);
    expect(result.performance.buying_guide_fallback_used).toBe(0);
    expect(result.performance.buying_guide_gate_ok).toBe(1);
  });

  it('rejette un guide anti-wiki et bascule sur le fallback safe', async () => {
    const transformer = makeTransformerMock();
    const rpcService = makeRpcServiceMock();
    const dbContract = { id: 479, pgId: '479' };
    const mappedGuide = makeAutoGuide();
    const fallbackGuide = {
      ...makeAutoGuide(),
      quality: {
        ...makeAutoGuide().quality,
        source: 'manual://automecanik/fallback-after-gate#pg=479',
      },
    };

    const buyingGuideService = {
      getBuyingGuideContractV1: jest.fn(async () => dbContract),
      toBuyingGuideV1: jest.fn(() => mappedGuide),
      passesBuyingGuideAntiWikiGate: jest.fn(() => ({
        ok: false,
        reasons: ['MISSING_SELECTION_CRITERIA', 'GENERIC_WITHOUT_ACTION'],
      })),
      buildAutoBuyingGuideV1: jest.fn(() => fallbackGuide),
    } as any;

    const service = new GammeResponseBuilderService(
      transformer,
      rpcService,
      buyingGuideService,
    );

    const result = await service.buildRpcV2Response('479');

    expect(buyingGuideService.toBuyingGuideV1).toHaveBeenCalledWith(dbContract);
    expect(buyingGuideService.buildAutoBuyingGuideV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pgId: '479',
      }),
    );
    expect(result.gammeBuyingGuide).toEqual(fallbackGuide);
    expect(result.performance.buying_guide_fallback_used).toBe(1);
    expect(result.performance.buying_guide_gate_ok).toBe(0);
    expect(result.performance.buying_guide_gate_reasons).toContain(
      'MISSING_SELECTION_CRITERIA',
    );
  });
});
