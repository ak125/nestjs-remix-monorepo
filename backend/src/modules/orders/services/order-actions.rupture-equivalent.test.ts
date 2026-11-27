/**
 * Mandat CL — un clic retient un équivalent d'une ligne en rupture : seules les
 * colonnes fournisseur de la ligne sont écrites, conditionnellement, la pièce
 * retenue est tracée, et l'écriture est défaite si la trace échoue. Données
 * inventées.
 */
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderActionsService } from './order-actions.service';
import type { OrdersService } from './orders.service';
import type { OrderLineSupplierService } from './order-line-supplier.service';
import {
  ACTION_EQUIVALENT_RETENU,
  type RuptureEquivalentsService,
  type VueEquivalents,
} from './rupture-equivalents.service';
import type { Equivalent } from './rupture-equivalents';
import { TABLES } from '@repo/database-types';

type Resultat = { data: unknown; error: unknown };

/**
 * Client factice : chaque `from()` ouvre une chaîne qui consomme le résultat
 * suivant de la file ; `select()` est attendable et offre `.single()`.
 */
function clientFactice(file: Resultat[]) {
  const chaines: { table: string; appels: [string, unknown[]][] }[] = [];
  const client = {
    from(table: string) {
      const chaine = { table, appels: [] as [string, unknown[]][] };
      chaines.push(chaine);
      const resultat = file.shift() ?? {
        data: null,
        error: { message: 'file vide' },
      };
      const q: Record<string, unknown> = {};
      for (const m of ['update', 'insert', 'eq', 'is', 'or', 'in']) {
        q[m] = (...args: unknown[]) => {
          chaine.appels.push([m, args]);
          return q;
        };
      }
      q.select = (...args: unknown[]) => {
        chaine.appels.push(['select', args]);
        const p = Promise.resolve(resultat);
        return Object.assign(p, {
          single: () => {
            chaine.appels.push(['single', []]);
            return p;
          },
        });
      };
      return q;
    },
  };
  return { client, chaines };
}

const EQUIVALENT: Equivalent = {
  pieceId: 9000002,
  marque: 'PLAQUEX',
  ref: 'PX 7777',
  statut: 'RETENABLE',
  preuve: {
    reference: {
      oemCommunes: ['OE 111'],
      citeeParCommandee: true,
      citeCommandee: false,
    },
    typeVehicule: 99001,
    criteres: {
      compares: [],
      nonCompares: [],
      compatible: true,
      ecartTotalMm: 0.2,
      aVerifier: 0,
    },
  },
  achat: {
    splId: '12',
    fournisseur: 'DCX DISTRIBUTION',
    libelleFournisseur: 'DCX',
    prixAchatUnitHt: 24.21,
    prixAchatHt: 48.42,
    quantite: 2,
    tauxTva: 0.2,
    origine: { type: 'TARIF', dateTarif: '2022-06-01T00:00:00.000Z' },
  },
  margeAuPrixPaye: { unitHt: 21.11, totalHt: 42.22, taux: 0.466 },
  supplementTtc: 0,
  venteSiteUnitTtc: 54.38,
};

const vue = (o: Partial<VueEquivalents> = {}): VueEquivalents =>
  ({
    orderId: 'CMD-TEST-1',
    lineId: 'CMD-TEST-1-L001',
    pieceId: 9000001,
    statutLigne: '4',
    commandee: { marque: 'FREINO', ref: 'FR 00.0001-1' },
    typeVehicule: null,
    toleranceMm: 0.5,
    sansRecherche: null,
    resultat: {
      equivalents: [{ ...EQUIVALENT, texteMail: { objet: '', corps: '' } }],
      tronques: 0,
      ecartes: {},
      motifsAchat: {},
    },
    fournisseurPose: false,
    retenu: null,
    ...o,
  }) as VueEquivalents;

const ATTENDU = { pieceId: 9000002, splId: '12', prixAchatUnitHt: 24.21 };

function sujet(lue: VueEquivalents, file: Resultat[]) {
  const emit = jest.fn();
  const ruptureEquivalents = {
    getEquivalents: jest.fn().mockResolvedValue(lue),
  } as unknown as RuptureEquivalentsService;
  const service = new OrderActionsService(
    { emit } as unknown as EventEmitter2,
    {} as OrdersService,
    {} as OrderLineSupplierService,
    ruptureEquivalents,
  );
  const { client, chaines } = clientFactice(file);
  Object.defineProperty(service, 'supabase', { value: client });
  return { service, emit, chaines };
}

const LIGNE_ECRITE: Resultat = {
  data: [{ orl_id: 'CMD-TEST-1-L001' }],
  error: null,
};
const TRACE_OK: Resultat = {
  data: { aal_id: 77, aal_created_at: '2026-11-18T19:00:00.000Z' },
  error: null,
};

describe('OrderActionsService.retainRuptureEquivalent', () => {
  it('écrit les seules colonnes fournisseur, au prix d’achat de l’équivalent, et trace la pièce', async () => {
    const { service, emit, chaines } = sujet(vue(), [LIGNE_ECRITE, TRACE_OK]);
    const r = await service.retainRuptureEquivalent(
      'CMD-TEST-1',
      'CMD-TEST-1-L001',
      ATTENDU,
      'admin-7',
    );

    const [ligne, trace] = chaines;
    expect(ligne.table).toBe(TABLES.xtr_order_line);
    const maj = ligne.appels.find(([m]) => m === 'update')?.[1][0] as Record<
      string,
      unknown
    >;
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
      orl_spl_id: '12',
      orl_spl_name: 'DCX DISTRIBUTION',
      orl_spl_price_buy_unit_ht: '24.21',
      orl_spl_price_buy_ht: '48.42',
      orl_spl_price_buy_unit_ttc: '29.05',
      orl_spl_price_buy_ttc: '58.1',
    });
    // conditions : la ligne, la commande, le statut rupture, aucun fournisseur posé
    expect(ligne.appels.filter(([m]) => m === 'eq').map(([, a]) => a)).toEqual([
      ['orl_id', 'CMD-TEST-1-L001'],
      ['orl_ord_id', 'CMD-TEST-1'],
      ['orl_orls_id', '4'],
    ]);
    expect(ligne.appels).toContainEqual([
      'or',
      ['orl_spl_id.is.null,orl_spl_id.in.("","0")'],
    ]);

    expect(trace.table).toBe('__admin_audit_log');
    const ins = trace.appels.find(([m]) => m === 'insert')?.[1][0] as Record<
      string,
      unknown
    >;
    expect(ins).toMatchObject({
      aal_action: ACTION_EQUIVALENT_RETENU,
      aal_entity_type: 'order_line',
      aal_entity_id: 'CMD-TEST-1-L001',
      aal_user_id: 'admin-7',
      aal_old_value: {
        pieceId: 9000001,
        marque: 'FREINO',
        ref: 'FR 00.0001-1',
      },
      aal_new_value: { pieceId: 9000002, marque: 'PLAQUEX', splId: '12' },
    });
    expect(r).toEqual({
      success: true,
      retenu: expect.objectContaining({
        traceId: '77',
        par: 'admin-7',
        pieceId: 9000002,
        prixAchatUnitHt: 24.21,
        dateTarif: '2022-06-01T00:00:00.000Z',
      }),
    });
    // ni statut, ni prix de vente, ni événement fournisseur
    expect(emit).not.toHaveBeenCalled();
    expect(chaines).toHaveLength(2);
  });

  it.each([
    ['ligne hors rupture', vue({ statutLigne: '3' }), ATTENDU],
    ['fournisseur déjà posé', vue({ fournisseurPose: true }), ATTENDU],
    [
      'équivalent déjà retenu',
      vue({ retenu: { traceId: '1' } as VueEquivalents['retenu'] }),
      ATTENDU,
    ],
    ['pièce plus proposée', vue(), { ...ATTENDU, pieceId: 1 }],
    ['fournisseur changé', vue(), { ...ATTENDU, splId: '7' }],
    ['prix changé', vue(), { ...ATTENDU, prixAchatUnitHt: 20 }],
    [
      'supplément requis',
      vue({
        resultat: {
          equivalents: [
            {
              ...EQUIVALENT,
              statut: 'SUPPLEMENT_REQUIS',
              texteMail: { objet: '', corps: '' },
            },
          ],
          tronques: 0,
          ecartes: {},
          motifsAchat: {},
        },
      }),
      ATTENDU,
    ],
  ])('409 sans aucune écriture : %s', async (_cas, lue, attendu) => {
    const { service, chaines } = sujet(lue, []);
    await expect(
      service.retainRuptureEquivalent('CMD-TEST-1', 'CMD-TEST-1-L001', attendu),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(chaines).toHaveLength(0);
  });

  it('409 si la ligne a changé entre la lecture et l’écriture, sans trace', async () => {
    const { service, chaines } = sujet(vue(), [{ data: [], error: null }]);
    await expect(
      service.retainRuptureEquivalent('CMD-TEST-1', 'CMD-TEST-1-L001', ATTENDU),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(chaines).toHaveLength(1);
  });

  it('trace impossible : l’écriture est défaite, conditionnellement, et rien n’est retenu', async () => {
    const { service, chaines } = sujet(vue(), [
      LIGNE_ECRITE,
      { data: null, error: { message: 'insert refusé' } },
      LIGNE_ECRITE,
    ]);
    await expect(
      service.retainRuptureEquivalent('CMD-TEST-1', 'CMD-TEST-1-L001', ATTENDU),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(chaines.map((c) => c.table)).toEqual([
      TABLES.xtr_order_line,
      '__admin_audit_log',
      TABLES.xtr_order_line,
    ]);
    const ecrit = chaines[0].appels.find(([m]) => m === 'update')?.[1][0] as {
      orl_spl_date: string;
    };
    const retour = chaines[2];
    const raz = retour.appels.find(([m]) => m === 'update')?.[1][0] as Record<
      string,
      unknown
    >;
    expect(Object.values(raz).every((v) => v === null)).toBe(true);
    expect(retour.appels.filter(([m]) => m === 'eq').map(([, a]) => a)).toEqual(
      [
        ['orl_id', 'CMD-TEST-1-L001'],
        ['orl_ord_id', 'CMD-TEST-1'],
        ['orl_spl_id', '12'],
        ['orl_spl_date', ecrit.orl_spl_date],
      ],
    );
  });
});
