import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SupplierCardService, toPatch } from './supplier-card.service';
import {
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
    ...overrides,
  };
}

/** Promo BOSCH de décembre (id 5) puis profil d'import de base (id 4). */
const PROFILES: SupplierPriceProfileRow[] = [
  profile({
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
    insertPriceProfile: jest.fn(
      async (r: Omit<SupplierPriceProfileRow, 'id'>) => ({ ...r, id: 99 }),
    ),
    setPriceProfileActive: jest.fn().mockResolvedValue(true),
    insertCard: jest.fn().mockResolvedValue(undefined),
    updateCard: jest.fn().mockResolvedValue(true),
    archive: jest.fn().mockResolvedValue(true),
    validateLocation: jest.fn().mockResolvedValue(true),
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
      isPromo: true,
      isImportBase: false,
      ruleStatus: 'a_venir',
      defaultRemisePct: 12.5,
      defaultMargePct: null,
    });
    expect(card.priceProfiles[1]).toMatchObject({
      isPromo: false,
      isImportBase: true,
      ruleStatus: 'sans_taux',
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

  it('marque × famille : reprend les paramètres d’import du profil de base', async () => {
    const { service, repo } = setup();
    const res = await service.createPriceRule('71', boschCables, 'u-42');
    expect(res).toEqual({ id: 99, version: 1 });
    expect(repo.setPriceProfileActive).not.toHaveBeenCalled();
    expect(repo.insertPriceProfile).toHaveBeenCalledWith({
      supplier_id: '71',
      scope_level: 'FAMILY',
      scope_code: 'NU17',
      brand_pm_id: '10',
      price_basis: 'BRUT',
      derivation: 'REMISE_ON_BRUT',
      key_field: 'REF',
      column_mapping: { ref: 'A', brut: 'C' },
      version: 1,
      effective_from: null,
      effective_to: null,
      created_by: 'u-42',
      change_reason: null,
      default_remise_pct: 30,
      default_marge_pct: null,
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
    expect(repo.insertPriceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        effective_from: '2026-12-01T00:00:00.000Z',
        effective_to: '2027-01-01T00:00:00.000Z',
        change_reason: 'PROMO câbles',
      }),
    );
  });

  it('même clé active : nouvelle version, l’ancienne désactivée d’abord', async () => {
    const { service, repo } = setup();
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
    expect(res.version).toBe(3);
    expect(repo.setPriceProfileActive).toHaveBeenCalledWith('71', 5, false);
    expect(repo.setPriceProfileActive.mock.invocationCallOrder[0]).toBeLessThan(
      repo.insertPriceProfile.mock.invocationCallOrder[0],
    );
  });

  it('échec d’insertion : l’ancienne version est réactivée, 409', async () => {
    const { service, repo } = setup();
    repo.insertPriceProfile.mockRejectedValueOnce(new PriceRuleConflictError());
    await expect(
      service.createPriceRule(
        '71',
        {
          scopeLevel: 'BRAND',
          brandPmId: '10',
          remisePct: 15,
          effectiveFrom: '2026-12-01',
          effectiveTo: '2026-12-31',
        },
        'u-42',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.setPriceProfileActive.mock.calls).toEqual([
      ['71', 5, false],
      ['71', 5, true],
    ]);
  });

  it('marque non liée au fournisseur : 400, rien écrit', async () => {
    const { service, repo } = setup();
    await expect(
      service.createPriceRule('71', { ...boschCables, brandPmId: '11' }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertPriceProfile).not.toHaveBeenCalled();
  });

  it('fournisseur absent : 404', async () => {
    const { service } = setup(null);
    await expect(
      service.createPriceRule('999', boschCables, 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['fournisseur', { scopeLevel: 'SUPPLIER' as const, remisePct: 10 }],
    [
      'marque',
      { scopeLevel: 'BRAND' as const, brandPmId: '10', remisePct: 10 },
    ],
  ])(
    'sans profil d’import de base, une règle %s est refusée (garde d’import)',
    async (_l, dto) => {
      const { service, repo } = setup(row(), []);
      await expect(
        service.createPriceRule('71', dto, 'u'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.insertPriceProfile).not.toHaveBeenCalled();
    },
  );

  it('sans profil de base, une règle de famille reste possible (jamais retenue par l’import)', async () => {
    const { service, repo } = setup(row(), []);
    await service.createPriceRule('71', boschCables, 'u');
    expect(repo.insertPriceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        price_basis: 'BRUT',
        derivation: 'REMISE_ON_BRUT',
        key_field: 'REF',
        column_mapping: {},
      }),
    );
  });
});

describe('SupplierCardService.retirePriceRule', () => {
  it('règle ordinaire : active = false, sans suppression', async () => {
    const { service, repo } = setup();
    await service.retirePriceRule('71', 5, 'u-42');
    expect(repo.setPriceProfileActive).toHaveBeenCalledWith('71', 5, false);
    expect(repo.insertPriceProfile).not.toHaveBeenCalled();
  });

  it('profil de base avec remise : nouvelle version sans remise, jamais désactivé sans remplaçant', async () => {
    const base = profile({ default_remise_pct: '8' });
    const { service, repo } = setup(row(), [base]);
    await service.retirePriceRule('71', 4, 'u-42');
    expect(repo.setPriceProfileActive).toHaveBeenCalledWith('71', 4, false);
    expect(repo.insertPriceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        scope_level: 'SUPPLIER',
        version: 4,
        column_mapping: { ref: 'A', brut: 'C' },
        default_remise_pct: null,
        default_marge_pct: null,
      }),
    );
  });

  it('ligne sans remise ni marge (profil d’import) : 409', async () => {
    const { service, repo } = setup();
    await expect(service.retirePriceRule('71', 4, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.setPriceProfileActive).not.toHaveBeenCalled();
  });

  it('règle inconnue, inactive ou d’un autre fournisseur : 404', async () => {
    const { service } = setup(row(), [profile({ id: 7, active: false })]);
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
