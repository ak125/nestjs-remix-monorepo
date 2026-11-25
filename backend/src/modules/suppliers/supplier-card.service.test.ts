import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SupplierCardService, toPatch } from './supplier-card.service';
import {
  BrandSourcesConflictError,
  BrandSourcesRejectedError,
  PriceRuleConflictError,
  SupplierIdConflictError,
  type SupplierCardRepository,
  type SupplierCardRow,
  type SupplierIdentity,
  type SupplierPriceProfileRow,
} from '../supplier-truth';

const IDENTITIES: SupplierIdentity[] = [
  { splId: '26', name: 'DISTRICASH (DCA)', alias: 'districash-dca' },
  { splId: '35', name: 'JACKOPARTS', alias: 'jackoparts' },
  { splId: '71', name: 'DCA', alias: 'dca' },
];

function row(overrides: Partial<SupplierCardRow> = {}): SupplierCardRow {
  return {
    spl_id: '71',
    spl_name: 'DCA',
    spl_alias: 'dca',
    spl_display: '1',
    spl_sort: null,
    spl_type: 'plateforme',
    spl_status: 'actif',
    spl_contact_name: null,
    spl_email: null,
    spl_phone: null,
    spl_website: null,
    spl_address: '1 rue X',
    spl_postcode: '92230',
    spl_city: 'Gennevilliers',
    spl_country: 'FR',
    spl_supply_mode: 'flux_tendu',
    spl_fallback_mode: 'transporteur',
    spl_location_validated_at: '2026-11-18T14:35:00Z',
    spl_location_validated_by: 'u-admin',
    spl_payment_terms: null,
    spl_franco_ht_cents: 15000,
    spl_delivery_delay_days: 1,
    spl_order_mode: 'portail',
    spl_portal_url: 'https://portail.example.test',
    spl_secret_name: 'SUPPLIER_DCA',
    spl_access_state: 'configure_non_verifie',
    spl_access_checked_at: null,
    spl_updated_at: null,
    spl_updated_by: null,
    ...overrides,
  };
}

function profile(
  overrides: Partial<SupplierPriceProfileRow> = {},
): SupplierPriceProfileRow {
  return {
    id: 4,
    supplier_id: '71',
    profile_kind: 'import',
    scope_level: 'SUPPLIER',
    scope_code: null,
    brand_pm_id: null,
    price_basis: 'BRUT',
    derivation: 'REMISE_ON_BRUT',
    key_field: 'REF',
    column_mapping: { ref: 'A', brut: 'C' },
    version: 3,
    effective_from: null,
    effective_to: null,
    active: true,
    created_by: 'import',
    change_reason: 'profil initial',
    created_at: '2026-11-01T00:00:00Z',
    default_remise_pct: null,
    default_marge_pct: null,
    retired_at: null,
    retired_by: null,
    ...overrides,
  };
}

/** Condition sans paramètre d'import (complément CH-3). */
function condition(
  overrides: Partial<SupplierPriceProfileRow> = {},
): SupplierPriceProfileRow {
  return profile({
    profile_kind: 'condition',
    price_basis: null,
    derivation: null,
    key_field: null,
    column_mapping: null,
    created_by: 'u-admin',
    ...overrides,
  });
}

/** Promo BOSCH de décembre (id 5, condition) puis profil d'import (id 4). */
const PROFILES: SupplierPriceProfileRow[] = [
  condition({
    id: 5,
    scope_level: 'BRAND',
    brand_pm_id: '10',
    version: 2,
    effective_from: '2026-12-01T00:00:00+00:00',
    effective_to: '2026-12-31T00:00:00+00:00',
    created_by: 'u-admin',
    change_reason: 'PROMO décembre',
    default_remise_pct: '12.5',
  }),
  profile(),
];

function summary(
  splId: string,
  name: string,
  type: string,
  supplyMode: string | null,
  status = 'actif',
) {
  return { splId, name, type, status, supplyMode, fallbackMode: null };
}

function setup(
  current: SupplierCardRow | null = row(),
  profiles: SupplierPriceProfileRow[] = PROFILES,
) {
  const repo = {
    getCard: jest.fn().mockResolvedValue(current),
    listIdentities: jest.fn().mockResolvedValue(IDENTITIES),
    getLinkedBrands: jest
      .fn()
      .mockResolvedValue([
        { linkId: '1', pmId: 10, brandName: 'BOSCH', linkDisplayed: true },
      ]),
    getPriceProfiles: jest.fn().mockResolvedValue(profiles),
    putPriceCondition: jest
      .fn()
      .mockResolvedValue({ id: 99, version: 1, replacedId: null }),
    retirePriceCondition: jest.fn().mockResolvedValue(true),
    insertCard: jest.fn().mockResolvedValue(undefined),
    updateCard: jest.fn().mockResolvedValue(true),
    archive: jest.fn().mockResolvedValue(true),
    validateLocation: jest.fn().mockResolvedValue(true),
    getBrand: jest.fn().mockResolvedValue({ name: 'MEAT & DORIA' }),
    getBrandLinks: jest.fn().mockResolvedValue([
      {
        linkId: '97',
        splId: '45',
        displayed: true,
        rank: 2,
        deliverySplId: '21',
        stockKind: 'commande',
        surchargeCents: 300,
        updatedAt: '2026-11-19T15:10:00+00:00',
        updatedBy: 'u-42',
      },
      {
        linkId: '98',
        splId: '52',
        displayed: true,
        rank: 1,
        deliverySplId: null,
        stockKind: 'stock',
        surchargeCents: 0,
        updatedAt: '2026-11-19T15:10:00+00:00',
        updatedBy: 'u-42',
      },
      {
        linkId: '30',
        splId: '26',
        displayed: true,
        rank: null,
        deliverySplId: null,
        stockKind: null,
        surchargeCents: null,
        updatedAt: null,
        updatedBy: null,
      },
    ]),
    listSummaries: jest
      .fn()
      .mockResolvedValue([
        summary('21', 'CS', 'plateforme', 'flux_tendu'),
        summary('26', 'DISTRICASH', 'plateforme', null, 'archive'),
        summary('45', 'MEAT & DORIA', 'marque_directe', null),
        summary('52', 'OTTOGO', 'plateforme', 'flux_tendu'),
      ]),
    putBrandSources: jest.fn().mockResolvedValue([
      { linkId: '98', rank: 1, created: true },
      { linkId: '97', rank: 2, created: false },
    ]),
  };
  const service = new SupplierCardService(
    repo as unknown as SupplierCardRepository,
  );
  return { repo, service };
}

describe('SupplierCardService.getCard', () => {
  it('404 si le fournisseur n’existe pas', async () => {
    const { service } = setup(null);
    await expect(service.getCard('999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sert nom et état du secret, jamais une valeur', async () => {
    const { service } = setup();
    const card = await service.getCard('71');
    expect(card.access).toEqual({
      secretName: 'SUPPLIER_DCA',
      state: 'configure_non_verifie',
      checkedAt: null,
    });
    expect(JSON.stringify(card)).not.toMatch(/password|token|valeur/i);
  });

  it('marques, profils (promo datée, pourcentage numérique) et doublon 26', async () => {
    jest.useFakeTimers({
      now: new Date('2026-11-18T12:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    const { service } = setup();
    const card = await service
      .getCard('71')
      .finally(() => jest.useRealTimers());
    expect(card.brands[0].brandName).toBe('BOSCH');
    expect(card.priceProfiles[0]).toMatchObject({
      scopeLevel: 'BRAND',
      brandPmId: '10',
      profileKind: 'condition',
      priceBasis: null,
      isPromo: true,
      ruleStatus: 'a_venir',
      defaultRemisePct: 12.5,
      defaultMargePct: null,
      retiredAt: null,
      retiredBy: null,
    });
    // Profil d'import : lecture seule, aucun état de règle.
    expect(card.priceProfiles[1]).toMatchObject({
      profileKind: 'import',
      priceBasis: 'BRUT',
      isPromo: false,
      ruleStatus: null,
      supersededBy: null,
    });
    expect(card.possibleDuplicates.map((d) => [d.splId, d.kind])).toEqual([
      ['26', 'exact'],
    ]);
    expect(card.conditions.francoHtCents).toBe(15000);
  });
});

describe('SupplierCardService.createCard', () => {
  it('refuse un doublon exact (409 avec les ids)', async () => {
    const { service, repo } = setup();
    const err = await service
      .createCard({ name: 'DCA' }, 'u-admin')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      duplicates: [{ splId: '26' }, { splId: '71' }],
    });
    expect(repo.insertCard).not.toHaveBeenCalled();
  });

  it('crée avec id max+1, alias dérivé, voisin signalé', async () => {
    const { service, repo } = setup();
    const res = await service.createCard(
      { name: 'JAKOPARTS', country: 'FR' },
      'u-admin',
    );
    expect(res.id).toBe('72');
    expect(res.possibleDuplicates.map((d) => [d.splId, d.kind])).toEqual([
      ['35', 'voisin'],
    ]);
    expect(repo.insertCard).toHaveBeenCalledWith(
      '72',
      { spl_name: 'JAKOPARTS', spl_alias: 'jakoparts', spl_country: 'FR' },
      'u-admin',
    );
  });

  it('collision de clé primaire → 409 explicite', async () => {
    const { service, repo } = setup();
    repo.insertCard.mockRejectedValue(new SupplierIdConflictError('72'));
    await expect(
      service.createCard({ name: 'BOSCH' }, 'u-admin'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SupplierCardService.updateCard', () => {
  it('un changement de ville efface la validation de localisation', async () => {
    const { service, repo } = setup();
    await service.updateCard('71', { city: 'Lyon' }, 'u-admin');
    expect(repo.updateCard).toHaveBeenCalledWith(
      '71',
      { spl_city: 'Lyon' },
      'u-admin',
      true,
    );
  });

  it('une valeur de localisation identique ne l’efface pas', async () => {
    const { service, repo } = setup();
    await service.updateCard(
      '71',
      { city: 'Gennevilliers', paymentTerms: '30 jours' },
      'u-admin',
    );
    expect(repo.updateCard).toHaveBeenCalledWith(
      '71',
      { spl_city: 'Gennevilliers', spl_payment_terms: '30 jours' },
      'u-admin',
      false,
    );
  });

  it('le nom renvoyé inchangé ne bloque pas une fiche en doublon historique', async () => {
    const { service, repo } = setup();
    await expect(
      service.updateCard('71', { name: 'DCA', phone: '0102030405' }, 'u-admin'),
    ).resolves.toEqual({ id: '71', possibleDuplicates: [] });
    expect(repo.listIdentities).not.toHaveBeenCalled();
  });

  it('un renommage vers un nom existant est refusé', async () => {
    const { service, repo } = setup();
    await expect(
      service.updateCard('71', { name: 'JACKOPARTS' }, 'u-admin'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateCard).not.toHaveBeenCalled();
  });

  it('404 si l’id n’existe pas', async () => {
    const { service } = setup(null);
    await expect(
      service.updateCard('999', { city: 'Lyon' }, 'u-admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SupplierCardService.validateLocation', () => {
  it('exige pays et mode d’approvisionnement', async () => {
    const { service, repo } = setup(row({ spl_supply_mode: null }));
    await expect(
      service.validateLocation('71', 'u-admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.validateLocation).not.toHaveBeenCalled();
  });

  it('enregistre l’auteur transmis (aucun nom codé en dur)', async () => {
    const { service, repo } = setup();
    await service.validateLocation('71', 'u-42');
    expect(repo.validateLocation).toHaveBeenCalledWith('71', 'u-42');
  });
});

describe('SupplierCardService.deactivateSupplier', () => {
  it('archive via le dépôt', async () => {
    const { service, repo } = setup();
    await service.deactivateSupplier('71', 'u-admin');
    expect(repo.archive).toHaveBeenCalledWith('71', 'u-admin');
  });

  it('404 si aucune ligne', async () => {
    const { service, repo } = setup();
    repo.archive.mockResolvedValue(false);
    await expect(
      service.deactivateSupplier('999', 'u-admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SupplierCardService.createPriceRule', () => {
  const boschCables = {
    scopeLevel: 'FAMILY' as const,
    brandPmId: '10',
    scopeCode: 'NU17',
    remisePct: 30,
  };

  it('marque × famille : une condition, sans aucun paramètre d’import', async () => {
    const { service, repo } = setup();
    const res = await service.createPriceRule('71', boschCables, 'u-42');
    expect(res).toEqual({ id: 99, version: 1 });
    expect(repo.putPriceCondition).toHaveBeenCalledTimes(1);
    expect(repo.putPriceCondition).toHaveBeenCalledWith({
      supplierId: '71',
      brandPmId: '10',
      scopeLevel: 'FAMILY',
      scopeCode: 'NU17',
      effectiveFrom: null,
      effectiveTo: null,
      remisePct: 30,
      margePct: null,
      changeReason: null,
      by: 'u-42',
    });
  });

  it('promo datée : jours convertis en instants UTC (début inclus, fin exclue)', async () => {
    const { service, repo } = setup();
    await service.createPriceRule(
      '71',
      {
        ...boschCables,
        effectiveFrom: '2026-12-01',
        effectiveTo: '2027-01-01',
        changeReason: 'PROMO câbles',
      },
      'u-42',
    );
    expect(repo.putPriceCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: '2027-01-01T00:00:00.000Z',
        changeReason: 'PROMO câbles',
      }),
    );
  });

  it('remplacement : un seul appel atomique, version rendue par la base', async () => {
    const { service, repo } = setup();
    repo.putPriceCondition.mockResolvedValueOnce({
      id: 100,
      version: 3,
      replacedId: 5,
    });
    const res = await service.createPriceRule(
      '71',
      {
        scopeLevel: 'BRAND',
        brandPmId: '10',
        remisePct: 15,
        effectiveFrom: '2026-12-01',
        effectiveTo: '2026-12-31',
      },
      'u-42',
    );
    expect(res).toEqual({ id: 100, version: 3 });
    expect(repo.putPriceCondition).toHaveBeenCalledTimes(1);
    expect(repo.retirePriceCondition).not.toHaveBeenCalled();
  });

  it('conflit en base : 409, aucune autre écriture', async () => {
    const { service, repo } = setup();
    repo.putPriceCondition.mockRejectedValueOnce(new PriceRuleConflictError());
    await expect(
      service.createPriceRule('71', boschCables, 'u-42'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.retirePriceCondition).not.toHaveBeenCalled();
  });

  it('marque non liée au fournisseur : 400, rien écrit', async () => {
    const { service, repo } = setup();
    await expect(
      service.createPriceRule('71', { ...boschCables, brandPmId: '11' }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.putPriceCondition).not.toHaveBeenCalled();
  });

  it('fournisseur absent : 404', async () => {
    const { service, repo } = setup(null);
    await expect(
      service.createPriceRule('999', boschCables, 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.putPriceCondition).not.toHaveBeenCalled();
  });

  it.each([
    ['fournisseur', { scopeLevel: 'SUPPLIER' as const, remisePct: 10 }],
    [
      'marque',
      { scopeLevel: 'BRAND' as const, brandPmId: '10', remisePct: 10 },
    ],
  ])(
    'sans profil d’import, une condition %s est acceptée (plus de recopie)',
    async (_l, dto) => {
      const { service, repo } = setup(row(), []);
      await service.createPriceRule('71', dto, 'u');
      expect(repo.getPriceProfiles).not.toHaveBeenCalled();
      expect(repo.putPriceCondition).toHaveBeenCalledWith(
        expect.objectContaining({ scopeLevel: dto.scopeLevel, by: 'u' }),
      );
    },
  );
});

describe('SupplierCardService.retirePriceRule', () => {
  it('condition : retirée avec son auteur, sans suppression', async () => {
    const { service, repo } = setup();
    await service.retirePriceRule('71', 5, 'u-42');
    expect(repo.retirePriceCondition).toHaveBeenCalledWith('71', 5, 'u-42');
    expect(repo.putPriceCondition).not.toHaveBeenCalled();
  });

  it('profil d’import : 409, jamais retiré depuis la fiche', async () => {
    const { service, repo } = setup();
    await expect(service.retirePriceRule('71', 4, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.retirePriceCondition).not.toHaveBeenCalled();
  });

  it('condition retirée entre-temps : 409', async () => {
    const { service, repo } = setup();
    repo.retirePriceCondition.mockResolvedValueOnce(false);
    await expect(service.retirePriceRule('71', 5, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('règle inconnue, inactive ou d’un autre fournisseur : 404', async () => {
    const { service } = setup(row(), [condition({ id: 7, active: false })]);
    await expect(service.retirePriceRule('71', 7, 'u')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.retirePriceRule('71', 123, 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('toPatch', () => {
  it('n’écrit que les clés présentes, null compris', () => {
    expect(toPatch({ phone: null, francoHtCents: 0, city: undefined })).toEqual(
      {
        spl_phone: null,
        spl_franco_ht_cents: 0,
      },
    );
  });
});

describe('SupplierCardService — sources d’achat par marque (mandat DQ)', () => {
  it('lit les sources classées, les liens non classés et les fiches actives', async () => {
    const { service, repo } = setup();
    const view = await service.getBrandSources('3030');
    expect(repo.getBrandLinks).toHaveBeenCalledWith(3030);
    expect(view.brandName).toBe('MEAT & DORIA');
    expect(
      view.sources.map((s) => [
        s.rank,
        s.source.name,
        s.delivery.name,
        s.surchargeCents,
        s.updatedBy,
      ]),
    ).toEqual([
      [1, 'OTTOGO', 'OTTOGO', 0, 'u-42'],
      [2, 'MEAT & DORIA', 'CS', 300, 'u-42'],
    ]);
    expect(view.issues).toEqual([]);
    expect(view.unrankedLinks).toEqual([
      { linkId: '30', splId: '26', name: 'DISTRICASH', displayed: true },
    ]);
    // Une fiche archivée n'est pas proposée comme source.
    expect(view.activeSuppliers.map((c) => c.splId)).toEqual([
      '21',
      '45',
      '52',
    ]);
  });

  it('400 sur un identifiant de marque non numérique, 404 sur une marque inconnue', async () => {
    const { service, repo } = setup();
    await expect(service.getBrandSources('30a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    repo.getBrand.mockResolvedValue(null);
    await expect(service.getBrandSources('9999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('écrit la liste dans l’ordre reçu, avec l’auteur', async () => {
    const { service, repo } = setup();
    const res = await service.putBrandSources(
      '3030',
      {
        sources: [
          { splId: '52', stockKind: 'stock', surchargeCents: 0 },
          {
            splId: '45',
            linkId: '97',
            deliverySplId: '21',
            stockKind: 'commande',
            surchargeCents: 300,
          },
        ],
      },
      'u-42',
    );
    expect(repo.putBrandSources).toHaveBeenCalledWith(
      3030,
      [
        {
          splId: '52',
          linkId: null,
          deliverySplId: null,
          stockKind: 'stock',
          surchargeCents: 0,
        },
        {
          splId: '45',
          linkId: '97',
          deliverySplId: '21',
          stockKind: 'commande',
          surchargeCents: 300,
        },
      ],
      'u-42',
    );
    expect(res.pmId).toBe(3030);
    expect(res.written).toHaveLength(2);
  });

  it('refus de la fonction → 400, rang pris entre-temps → 409', async () => {
    const { service, repo } = setup();
    repo.putBrandSources.mockRejectedValueOnce(
      new BrandSourcesRejectedError('fournisseur 26 non actif (archive)'),
    );
    await expect(
      service.putBrandSources('3030', { sources: [] }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    repo.putBrandSources.mockRejectedValueOnce(new BrandSourcesConflictError());
    await expect(
      service.putBrandSources('3030', { sources: [] }, 'u'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
