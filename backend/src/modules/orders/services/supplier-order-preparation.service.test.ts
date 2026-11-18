/**
 * Mandat BK — préparation d'une commande fournisseur en mode essai : trace,
 * double clic, reprise, course entre processus, flag d'envoi sans effet.
 * Complément n° 4 : la lecture est le dernier relevé fourni par
 * `getProposal` ; le service n'a plus aucun accès à un portail.
 */
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import { InternalServerErrorException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { LectureLive, ResultatLecture } from '../../supplier-truth';
import type {
  OrderLineSupplierService,
  PropositionLigne,
} from './order-line-supplier.service';
import {
  ACTION_PREPAREE,
  ACTION_REFUSEE,
  SupplierOrderPreparationService,
} from './supplier-order-preparation.service';

type Ligne = Record<string, unknown>;

/** Faux client Supabase en mémoire, limité aux requêtes du service. */
function baseFactice(opts: {
  indexUnique?: boolean;
  erreurInsert?: { code: string; message: string };
  /** Simule un autre processus qui écrit entre la lecture et l'insertion. */
  concurrentAvantInsert?: boolean;
}) {
  const commande = { ord_id: 'ORD-1', ord_is_pay: '1', ord_ords_id: '1' };
  const ligne: Ligne = {
    orl_id: 'L1',
    orl_ord_id: 'ORD-1',
    orl_art_ref: '500 0728 10',
    orl_pm_name: 'LUK',
    orl_art_quantity: '2',
    orl_art_price_sell_unit_ttc: '54.00',
    orl_orls_id: '1',
    orl_spl_id: null,
    orl_spl_price_buy_unit_ht: null,
  };
  const journal: Ligne[] = [];
  let n = 0;

  const client = {
    from(table: string) {
      const filtres: [string, unknown][] = [];
      let insertion: Ligne | null = null;
      let tete = false;
      const lignes = (): Ligne[] => {
        const src =
          table === '__admin_audit_log'
            ? journal
            : table.includes('order_line')
              ? [ligne]
              : [commande];
        return src
          .filter((r) => filtres.every(([k, v]) => r[k] === v))
          .sort((a, b) =>
            String(b.aal_created_at ?? '').localeCompare(
              String(a.aal_created_at ?? ''),
            ),
          );
      };
      const executer = () => {
        if (insertion) {
          if (opts.erreurInsert)
            return { data: null, error: opts.erreurInsert };
          if (
            opts.concurrentAvantInsert &&
            insertion.aal_action === ACTION_PREPAREE
          ) {
            journal.push({
              ...insertion,
              aal_id: 'autre-processus',
              aal_created_at: '2026-11-17T18:00:00Z',
            });
            opts.concurrentAvantInsert = false;
          }
          const doublon = journal.some(
            (r) =>
              r.aal_action === ACTION_PREPAREE &&
              insertion!.aal_action === ACTION_PREPAREE &&
              r.aal_entity_id === insertion!.aal_entity_id,
          );
          if (opts.indexUnique && doublon) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key' },
            };
          }
          n += 1;
          const r = {
            ...insertion,
            aal_id: `trace-${n}`,
            aal_created_at: `2026-11-17T18:0${n}:00Z`,
          };
          journal.push(r);
          return { data: { aal_id: r.aal_id }, error: null };
        }
        const l = lignes();
        return tete
          ? { count: l.length, error: null }
          : { data: l[0] ?? null, error: null };
      };
      const q = {
        select(_c: string, o?: { head?: boolean }) {
          tete = o?.head === true;
          return q;
        },
        insert(r: Ligne) {
          insertion = r;
          return q;
        },
        eq(k: string, v: unknown) {
          filtres.push([k, v]);
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => executer(),
        single: async () => executer(),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(executer()).then(ok, ko),
      };
      return q;
    },
  };
  return { client, journal, ligne, commande };
}

const PROPOSITION: PropositionLigne = {
  orderId: 'ORD-1',
  lineId: 'L1',
  pieceId: 42,
  statutLigne: '1',
  fournisseurConfirme: null,
  proposition: {
    statut: 'PROPOSE',
    splId: '71',
    nomFournisseur: 'DCA',
    libelleFournisseur: 'DCA',
    prixAchatUnitHt: 23.4,
    quantite: 2,
    prixAchatHt: 46.8,
    tauxTva: 0.2,
    offresVendables: 1,
    offresEcartees: [],
    origine: { type: 'RELEVE', observeA: '2026-11-17T17:59:57.000Z' },
  },
  releveFournisseurPropose: null,
};

const LIVE: LectureLive = {
  ok: true,
  source: 'RELEVE',
  splId: '71',
  plateforme: 'inoshop',
  refDemandee: '500 0728 10',
  refFournisseur: '500072810',
  correspondance: 'EXACTE',
  prixPublicHt: 63.23,
  remisePct: 63,
  remise2Pct: 0,
  prixNetHt: 23.4,
  disponible: true,
  delaiJours: null,
  detailDispo: 'CONFIRMED_AG (ag)',
  lueA: '2026-11-17T17:59:57.000Z',
};

function sujet(
  opts: Parameters<typeof baseFactice>[0] = { indexUnique: true },
  flag?: string,
  releve: ResultatLecture | null = LIVE,
) {
  const base = baseFactice(opts);
  // Seule méthode exposée : `getProposal`. Toute autre lèverait.
  const lire = jest
    .fn()
    .mockResolvedValue({ ...PROPOSITION, releveFournisseurPropose: releve });
  const lineSupplier = new Proxy(
    { getProposal: lire },
    {
      get(t, p) {
        if (p === 'getProposal' || p === 'then' || typeof p === 'symbol')
          return Reflect.get(t, p);
        throw new Error(`appel interdit : ${String(p)}`);
      },
    },
  ) as unknown as OrderLineSupplierService;
  const config = {
    get: (k: string) =>
      k === 'SUPPLIER_ORDER_SEND_ENABLED' ? flag : undefined,
  } as unknown as ConfigService;
  const service = new SupplierOrderPreparationService(lineSupplier, config);
  Object.defineProperty(service, 'supabase', { value: base.client });
  return { service, lire, ...base };
}

const OUI = { compatibiliteVerifiee: true };

describe('SupplierOrderPreparationService', () => {
  it('prépare, trace la ligne et n’envoie rien', async () => {
    const { service, journal, lire } = sujet();
    const r = await service.prepare('ORD-1', 'L1', OUI, '42');
    expect(r.decision).toBe('PREPAREE');
    expect(r.envoi).toEqual(
      expect.objectContaining({ effectue: false, flagActif: false }),
    );
    expect(r.preparation).toMatchObject({
      mode: 'ESSAI',
      numeroEssai: 1,
      envoyee: false,
      fournisseur: { splId: '71', nom: 'DCA' },
      refFournisseur: '500072810',
      quantite: 2,
      prixPublicHt: 63.23,
      remisePct: 63,
      prixNetUnitHt: 23.4,
      montantNetHt: 46.8,
    });
    expect(lire).toHaveBeenCalledWith('ORD-1', 'L1');
    expect(r.lecture).toBe(LIVE);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      aal_action: ACTION_PREPAREE,
      aal_entity_type: 'order_line',
      aal_entity_id: 'L1',
      aal_user_id: '42',
    });
    expect(
      (journal[0].aal_metadata as { controles: unknown[] }).controles,
    ).toHaveLength(8);
    expect(r.traceId).toBe('trace-1');
  });

  it('double clic simultané : une seule lecture, une seule préparation', async () => {
    const { service, journal, lire } = sujet();
    const [a, b] = await Promise.all([
      service.prepare('ORD-1', 'L1', OUI, '42'),
      service.prepare('ORD-1', 'L1', OUI, '42'),
    ]);
    expect(a).toBe(b);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(
      journal.filter((r) => r.aal_action === ACTION_PREPAREE),
    ).toHaveLength(1);
  });

  it('reprise après coup : DEJA_PREPAREE, la trace existante fait foi', async () => {
    const { service, journal } = sujet();
    await service.prepare('ORD-1', 'L1', OUI, '42');
    const r = await service.prepare('ORD-1', 'L1', OUI, '42');
    expect(r.decision).toBe('DEJA_PREPAREE');
    expect(r.traceId).toBe('trace-1');
    expect(r.lecture).toBeNull();
    expect(journal).toHaveLength(1);
  });

  it('course entre deux processus : la violation d’unicité devient DEJA_PREPAREE', async () => {
    const { service, journal } = sujet({
      indexUnique: true,
      concurrentAvantInsert: true,
    });
    const r = await service.prepare('ORD-1', 'L1', OUI, '42');
    expect(r.decision).toBe('DEJA_PREPAREE');
    expect(r.traceId).toBe('autre-processus');
    expect(
      journal.filter((x) => x.aal_action === ACTION_PREPAREE),
    ).toHaveLength(1);
  });

  it.each([['relevé absent'], ['relevé de plus de 30 min']])(
    '%s : refus tracé, contrôles 1, 2 et 6 bloqués',
    async (motif) => {
      const { service, journal } = sujet({ indexUnique: true }, undefined, {
        ok: false,
        splId: '71',
        motif: motif === 'relevé absent' ? 'RELEVE_ABSENT' : 'RELEVE_PERIME',
        detail: motif,
        lueA: '2026-11-18T09:00:00.000Z',
      });
      const r = await service.prepare('ORD-1', 'L1', OUI, '42');
      expect(r.decision).toBe('BLOQUEE');
      expect(r.preparation).toBeNull();
      for (const id of [1, 2, 6])
        expect(r.controles.find((x) => x.id === id)?.detail).toBe(motif);
      expect(journal[0].aal_action).toBe(ACTION_REFUSEE);
    },
  );

  it('case non cochée : refus tracé, rien de préparé', async () => {
    const { service, journal } = sujet();
    const r = await service.prepare(
      'ORD-1',
      'L1',
      { compatibiliteVerifiee: false },
      '42',
    );
    expect(r.decision).toBe('BLOQUEE');
    expect(r.preparation).toBeNull();
    expect(journal).toHaveLength(1);
    expect(journal[0].aal_action).toBe(ACTION_REFUSEE);
    expect(journal[0].aal_new_value).toBeNull();
  });

  it('écriture de la trace en échec : erreur, jamais un succès silencieux', async () => {
    const { service } = sujet({
      erreurInsert: { code: '42501', message: 'permission denied' },
    });
    await expect(
      service.prepare('ORD-1', 'L1', OUI, '42'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('flag d’envoi à « true » : toujours préparée, jamais envoyée', async () => {
    const { service } = sujet({ indexUnique: true }, 'true');
    const r = await service.prepare('ORD-1', 'L1', OUI, '42');
    expect(r.decision).toBe('PREPAREE');
    expect(r.envoi).toEqual(
      expect.objectContaining({ flagActif: true, effectue: false }),
    );
    expect(r.preparation?.envoyee).toBe(false);
  });

  it('écran : comparaison avec la commande passée à la main', async () => {
    const { service, ligne } = sujet();
    await service.prepare('ORD-1', 'L1', OUI, '42');
    ligne.orl_spl_id = '71';
    ligne.orl_spl_price_buy_unit_ht = '23.90';
    const v = await service.getPrepared('ORD-1', 'L1');
    expect(v.preparee).toMatchObject({ traceId: 'trace-1', numeroEssai: 1 });
    expect(v.comparaisonManuelle).toEqual({
      splIdManuel: '71',
      memeFournisseur: true,
      prixManuelUnitHt: 23.9,
      ecartUnitHt: -0.5,
    });
  });
});
