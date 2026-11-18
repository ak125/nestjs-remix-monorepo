/**
 * Décision 50 — confirmation du fournisseur d'une ligne en un geste et marquage
 * de rupture : écritures bornées, conditionnelles, jamais sur une proposition
 * périmée.
 */
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import { ConflictException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderActionsService, STATUT_RUPTURE } from './order-actions.service';
import type { OrdersService } from './orders.service';
import type {
  OrderLineSupplierService,
  PropositionLigne,
} from './order-line-supplier.service';
import { ORDER_EVENTS } from '../events/order.events';

/** Constructeur de requête factice : enregistre les appels, rend `resultat`. */
function requeteFactice(resultat: { data: unknown; error: unknown }) {
  const appels: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['from', 'update', 'eq', 'is', 'or', 'in']) {
    q[m] = (...args: unknown[]) => {
      appels.push([m, args]);
      return q;
    };
  }
  q.select = (...args: unknown[]) => {
    appels.push(['select', args]);
    return Promise.resolve(resultat);
  };
  return { client: q, appels };
}

const propose = (o: Partial<PropositionLigne> = {}): PropositionLigne => ({
  orderId: 'ORD-1',
  lineId: 'ORD-1-L001',
  pieceId: 42,
  statutLigne: null,
  fournisseurConfirme: null,
  proposition: {
    statut: 'PROPOSE',
    splId: '3',
    nomFournisseur: 'ACR',
    libelleFournisseur: 'ACR',
    prixAchatUnitHt: 10,
    quantite: 2,
    prixAchatHt: 20,
    tauxTva: 0.2,
    offresVendables: 1,
    offresEcartees: [],
  },
  ...o,
});

function sujet(
  lue: PropositionLigne,
  resultat: { data: unknown; error: unknown } = {
    data: [{ orl_id: 'ORD-1-L001' }],
    error: null,
  },
) {
  const emit = jest.fn();
  const lineSupplier = {
    getProposal: jest.fn().mockResolvedValue(lue),
  } as unknown as OrderLineSupplierService;
  const service = new OrderActionsService(
    { emit } as unknown as EventEmitter2,
    {} as OrdersService,
    lineSupplier,
    {} as never, // billing — hors du chemin de la confirmation fournisseur
  );
  const { client, appels } = requeteFactice(resultat);
  Object.defineProperty(service, 'supabase', { value: client });
  return { service, emit, appels };
}

const ecriture = (appels: [string, unknown[]][]) =>
  appels.find(([m]) => m === 'update')?.[1][0] as Record<string, unknown>;

describe('OrderActionsService.confirmLineSupplier', () => {
  it('écrit les seules colonnes fournisseur, TTC au taux de l’offre, et trace', async () => {
    const { service, emit, appels } = sujet(propose());
    const r = await service.confirmLineSupplier(
      'ORD-1',
      'ORD-1-L001',
      { splId: '3', prixAchatUnitHt: 10 },
      'admin-7',
    );
    expect(r).toMatchObject({ success: true, splId: '3', purchaseHt: 20 });
    const maj = ecriture(appels);
    expect(Object.keys(maj).sort()).toEqual([
      'orl_spl_date',
      'orl_spl_id',
      'orl_spl_name',
      'orl_spl_price_buy_ht',
      'orl_spl_price_buy_ttc',
      'orl_spl_price_buy_unit_ht',
      'orl_spl_price_buy_unit_ttc',
    ]);
    expect(maj).toMatchObject({
      orl_spl_id: '3',
      orl_spl_name: 'ACR',
      orl_spl_price_buy_unit_ht: '10',
      orl_spl_price_buy_ht: '20',
      orl_spl_price_buy_unit_ttc: '12',
      orl_spl_price_buy_ttc: '24',
    });
    // conditionnelle : fournisseur non posé ET statut lu inchangé
    expect(appels).toContainEqual([
      'or',
      ['orl_spl_id.is.null,orl_spl_id.in.("","0")'],
    ]);
    expect(appels).toContainEqual(['is', ['orl_orls_id', null]]);
    expect(emit).toHaveBeenCalledWith(
      ORDER_EVENTS.LINE_SUPPLIER_CONFIRMED,
      expect.objectContaining({ splId: '3', confirmedBy: 'admin-7' }),
    );
  });

  it('TVA inconnue → TTC laissés vides, jamais de taux inventé', async () => {
    const lue = propose();
    if (lue.proposition.statut === 'PROPOSE') lue.proposition.tauxTva = null;
    const { service, appels } = sujet(lue);
    await service.confirmLineSupplier('ORD-1', 'ORD-1-L001', {
      splId: '3',
      prixAchatUnitHt: 10,
    });
    expect(ecriture(appels)).toMatchObject({
      orl_spl_price_buy_unit_ttc: null,
      orl_spl_price_buy_ttc: null,
    });
  });

  it.each([
    ['fournisseur différent', { splId: '71', prixAchatUnitHt: 10 }],
    ['prix différent', { splId: '3', prixAchatUnitHt: 9.99 }],
  ])('proposition changée (%s) → 409 sans écriture', async (_, attendu) => {
    const { service, emit, appels } = sujet(propose());
    await expect(
      service.confirmLineSupplier('ORD-1', 'ORD-1-L001', attendu),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ecriture(appels)).toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it('RUPTURE ou A_COMPLETER → 409 sans écriture', async () => {
    for (const proposition of [
      { statut: 'RUPTURE', offresVendables: 0, procedure: 'x' },
      { statut: 'A_COMPLETER', offresVendables: 1, offresEcartees: [] },
    ] as PropositionLigne['proposition'][]) {
      const { service, appels } = sujet(propose({ proposition }));
      await expect(
        service.confirmLineSupplier('ORD-1', 'ORD-1-L001', {
          splId: '3',
          prixAchatUnitHt: 10,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ecriture(appels)).toBeUndefined();
    }
  });

  it('fournisseur déjà posé → 409, pas d’écrasement', async () => {
    const { service, appels } = sujet(
      propose({
        fournisseurConfirme: {
          splId: '19',
          nom: 'CAL',
          date: null,
          prixAchatUnitHt: '8',
          prixAchatHt: '16',
        },
      }),
    );
    await expect(
      service.confirmLineSupplier('ORD-1', 'ORD-1-L001', {
        splId: '3',
        prixAchatUnitHt: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ecriture(appels)).toBeUndefined();
  });

  it.each(['2', '3', '4', '6', '91'])(
    'ligne au statut %s → 409',
    async (statutLigne) => {
      const { service, appels } = sujet(propose({ statutLigne }));
      await expect(
        service.confirmLineSupplier('ORD-1', 'ORD-1-L001', {
          splId: '3',
          prixAchatUnitHt: 10,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ecriture(appels)).toBeUndefined();
    },
  );

  it('ligne modifiée entre lecture et écriture (0 ligne touchée) → 409, pas d’événement', async () => {
    const { service, emit } = sujet(propose({ statutLigne: '1' }), {
      data: [],
      error: null,
    });
    await expect(
      service.confirmLineSupplier('ORD-1', 'ORD-1-L001', {
        splId: '3',
        prixAchatUnitHt: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('OrderActionsService.markLineRupture', () => {
  it('pose le statut 4 seul, conditionnellement, et renvoie la procédure', async () => {
    const { service, emit, appels } = sujet(propose({ statutLigne: '6' }));
    const r = await service.markLineRupture('ORD-1', 'ORD-1-L001', 'admin-7');
    expect(ecriture(appels)).toEqual({ orl_orls_id: STATUT_RUPTURE });
    expect(appels).toContainEqual(['eq', ['orl_orls_id', '6']]);
    expect(r.procedure).toBe(
      '.claude/skills/order-rupture-equivalence/SKILL.md',
    );
    expect(emit).toHaveBeenCalledWith(
      ORDER_EVENTS.LINE_STATUS_CHANGED,
      expect.objectContaining({
        previousStatus: '6',
        newStatus: 4,
        changedBy: 'admin-7',
      }),
    );
  });

  it.each(['2', '3', '4', '92'])('ligne au statut %s → 409', async (s) => {
    const { service, appels } = sujet(propose({ statutLigne: s }));
    await expect(
      service.markLineRupture('ORD-1', 'ORD-1-L001'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ecriture(appels)).toBeUndefined();
  });
});
