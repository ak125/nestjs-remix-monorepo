import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SupplierCardService, toPatch } from './supplier-card.service';
import {
  SupplierIdConflictError,
  type SupplierCardRepository,
  type SupplierCardRow,
  type SupplierIdentity,
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

function setup(current: SupplierCardRow | null = row()) {
  const repo = {
    getCard: jest.fn().mockResolvedValue(current),
    listIdentities: jest.fn().mockResolvedValue(IDENTITIES),
    getLinkedBrands: jest
      .fn()
      .mockResolvedValue([
        { linkId: '1', pmId: 10, brandName: 'BOSCH', linkDisplayed: true },
      ]),
    getPriceProfiles: jest.fn().mockResolvedValue([
      {
        id: 5,
        scope_level: 'BRAND',
        scope_code: null,
        price_basis: 'NET',
        derivation: 'MARGIN',
        key_field: 'pri_ref',
        version: 2,
        effective_from: '2026-12-01',
        effective_to: '2026-12-31',
        active: true,
        created_by: 'u-admin',
        change_reason: 'PROMO décembre',
        created_at: '2026-11-18T00:00:00Z',
        default_remise_pct: '12.5',
        default_marge_pct: null,
      },
    ]),
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
    const { service } = setup();
    const card = await service.getCard('71');
    expect(card.brands[0].brandName).toBe('BOSCH');
    expect(card.priceProfiles[0]).toMatchObject({
      scopeLevel: 'BRAND',
      isPromo: true,
      defaultRemisePct: 12.5,
      defaultMargePct: null,
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
