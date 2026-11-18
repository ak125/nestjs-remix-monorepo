import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupplierConnectorConfig } from './connectors/supplier-registry';
import type {
  DemandeLecture,
  ResultatLecture,
  SupplierLiveQuoteService,
} from './supplier-live-quote.service';
import { SupplierOfferReleveRunner } from './supplier-offer-releve.runner';
import {
  SupplierTruthRepository,
  type LigneAReleve,
  type OfferSnapshotInsert,
} from './supplier-truth.repository';

/** Complément BK n° 4 — données synthétiques uniquement (dépôt public). */

const CAL = {
  supplierId: '19',
  supplierName: 'CAL',
} as SupplierConnectorConfig;
const DCA = {
  supplierId: '71',
  supplierName: 'DCA',
} as SupplierConnectorConfig;

const ligne = (o: Partial<LigneAReleve>): LigneAReleve => ({
  lineId: 'L1',
  orderId: 'O1',
  pieceId: 1,
  ref: 'R1',
  pmId: 100,
  marque: 'MARQUE-A',
  ...o,
});

function sujet(opts: {
  lignes: LigneAReleve[];
  marques: Record<string, number[]>;
  lecture?: (splId: string, d: DemandeLecture) => ResultatLecture;
  max?: number;
}) {
  const ecrits: OfferSnapshotInsert[] = [];
  const repo = {
    getReleveWorkingSet: jest.fn(async () => opts.lignes),
    getSupplierLinkedBrands: jest.fn(
      async (id: string) => opts.marques[id] ?? [],
    ),
    insertOffer: jest.fn(async (o: OfferSnapshotInsert) => {
      ecrits.push(o);
    }),
  } as unknown as SupplierTruthRepository;
  const lecture =
    opts.lecture ??
    ((splId: string, d: DemandeLecture): ResultatLecture => ({
      ok: true,
      source: 'PORTAIL',
      splId,
      plateforme: 'cal',
      refDemandee: d.ref,
      refFournisseur: null,
      correspondance: 'EXACTE',
      prixPublicHt: 20,
      remisePct: 50,
      remise2Pct: null,
      prixNetHt: 10,
      disponible: true,
      delaiJours: null,
      detailDispo: 'disponible',
      lueA: '2026-11-18T10:00:00.000Z',
    }));
  const lireLot = jest.fn(async (splId: string, demandes: DemandeLecture[]) =>
    demandes.map((d) => lecture(splId, d)),
  );
  const liveQuote = { lireLot } as unknown as SupplierLiveQuoteService;
  const emit = jest.fn();
  const runner = new SupplierOfferReleveRunner(
    repo,
    liveQuote,
    emit,
    opts.max ?? 50,
    () => [CAL, DCA],
  );
  return { runner, lireLot, ecrits, emit };
}

describe('SupplierOfferReleveRunner', () => {
  it('interroge chaque fournisseur qui porte la marque, et lui seul', async () => {
    const { runner, lireLot, ecrits } = sujet({
      lignes: [
        ligne({ lineId: 'L1', pieceId: 1, ref: 'R1', pmId: 100 }),
        ligne({ lineId: 'L2', pieceId: 2, ref: 'R2', pmId: 200, marque: 'B' }),
      ],
      marques: { '19': [100, 200], '71': [200] },
    });
    const r = await runner.runReleve();
    expect(lireLot).toHaveBeenCalledWith('19', [
      { ref: 'R1', marque: 'MARQUE-A' },
      { ref: 'R2', marque: 'B' },
    ]);
    expect(lireLot).toHaveBeenCalledWith('71', [{ ref: 'R2', marque: 'B' }]);
    expect(ecrits.map((e) => [e.supplier_id, e.piece_id_i])).toEqual([
      ['19', 1],
      ['19', 2],
      ['71', 2],
    ]);
    expect(r).toMatchObject({
      lignes: 2,
      relevesEcrits: 3,
      fournisseursLus: 2,
    });
  });

  it('marque sans fournisseur lié : aucune lecture, compté', async () => {
    const { runner, lireLot } = sujet({
      lignes: [ligne({ pmId: 999 })],
      marques: { '19': [100], '71': [200] },
    });
    const r = await runner.runReleve();
    expect(lireLot).not.toHaveBeenCalled();
    expect(r.fournisseursSansMarque).toBe(2);
  });

  it('plafond par fournisseur et par passage, lignes les plus récentes d’abord', async () => {
    const { runner, lireLot } = sujet({
      lignes: [1, 2, 3].map((i) => ligne({ pieceId: i, ref: `R${i}` })),
      marques: { '19': [100] },
      max: 2,
    });
    await runner.runReleve();
    expect(lireLot).toHaveBeenCalledWith('19', [
      { ref: 'R1', marque: 'MARQUE-A' },
      { ref: 'R2', marque: 'MARQUE-A' },
    ]);
  });

  it('dédoublonne une même pièce commandée deux fois', async () => {
    const { runner, lireLot } = sujet({
      lignes: [ligne({ lineId: 'L1' }), ligne({ lineId: 'L2', orderId: 'O2' })],
      marques: { '19': [100] },
    });
    await runner.runReleve();
    expect(lireLot.mock.calls[0][1]).toHaveLength(1);
  });

  it('lecture impossible : aucun relevé écrit, événement observable', async () => {
    const { runner, ecrits, emit } = sujet({
      lignes: [ligne({})],
      marques: { '19': [100] },
      lecture: (splId) => ({
        ok: false,
        splId,
        motif: 'IDENTIFIANTS_ABSENTS',
        detail: 'identifiants VAR_USER/VAR_PASS absents',
        lueA: '2026-11-18T10:00:00.000Z',
      }),
    });
    const r = await runner.runReleve();
    expect(ecrits).toEqual([]);
    expect(r).toMatchObject({ fournisseursEnEchec: 1, relevesEcrits: 0 });
    expect(emit).toHaveBeenCalledWith(
      'supplier.releve.lecture_impossible',
      expect.objectContaining({
        supplierId: '19',
        motif: 'IDENTIFIANTS_ABSENTS',
        echecs: 1,
      }),
    );
  });

  it('aucune ligne à relever : aucun fournisseur interrogé', async () => {
    const { runner, lireLot } = sujet({ lignes: [], marques: { '19': [100] } });
    expect(await runner.runReleve()).toMatchObject({ lignes: 0 });
    expect(lireLot).not.toHaveBeenCalled();
  });
});

/**
 * Complément BK n° 5 — de bout en bout, en données inventées : le vrai
 * repository sur une base simulée, la table ___xtr_supplier_link_pm lue avant
 * puis après les liens de la migration 20261118 (couples lus dans le fichier).
 */
describe('liens SEIM / LUK (migration 20261118) : une ligne payée reçoit un relevé', () => {
  const MIGRATION = join(
    __dirname,
    '../../../supabase/migrations/20261118_supplier_link_pm_dca_cal_seim_luk.sql',
  );
  const liensMigration = (): { spl: string; pm: string }[] => {
    const voulu = readFileSync(MIGRATION, 'utf8').match(
      /WITH voulu \(rang, spl, pm\) AS \(\s*VALUES ([^\n]+)/,
    );
    return [...(voulu?.[1] ?? '').matchAll(/\(\d+, '(\d+)', '(\d+)'\)/g)].map(
      (m) => ({ spl: m[1], pm: m[2] }),
    );
  };

  type Ligne = Record<string, unknown>;
  /** Base simulée : chaque table est une liste de lignes ; eq / in filtrent. */
  function base(tables: Record<string, Ligne[]>) {
    const inseres: Ligne[] = [];
    const from = (table: string) => {
      const filtres: ((r: Ligne) => boolean)[] = [];
      const chaine: Record<string, unknown> = {};
      const suite = () => chaine;
      for (const m of ['select', 'or', 'order', 'limit']) chaine[m] = suite;
      chaine.eq = (col: string, v: unknown) => {
        filtres.push((r) => String(r[col]) === String(v));
        return chaine;
      };
      chaine.in = (col: string, vs: unknown[]) => {
        filtres.push((r) => vs.map(String).includes(String(r[col])));
        return chaine;
      };
      chaine.insert = async (o: Ligne) => {
        inseres.push(o);
        return { error: null };
      };
      (chaine as { then: unknown }).then = (ok: (v: unknown) => unknown) =>
        ok({
          data: (tables[table] ?? []).filter((r) => filtres.every((f) => f(r))),
          error: null,
        });
      return chaine;
    };
    return { client: { from }, inseres };
  }

  const cfg = {
    get: (k: string) =>
      ({
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
      })[k],
  } as unknown as import('@nestjs/config').ConfigService;

  function scenario(liens: { spl: string; pm: string }[]) {
    const db = base({
      ___xtr_order: [
        { ord_id: 'ORD-TEST-1', ord_date: '2026-11-18', ord_is_pay: '1' },
      ],
      __admin_audit_log: [],
      // Lignes payées de 2026 : orl_pm_id vide, la marque vient de la pièce.
      ___xtr_order_line: [
        {
          orl_id: 'ORD-TEST-1-L001',
          orl_ord_id: 'ORD-TEST-1',
          orl_pg_id: '9001',
          orl_art_ref: 'REF SEIM 1',
          orl_pm_id: '',
          orl_pm_name: 'SEIM',
          orl_orls_id: null,
        },
        {
          orl_id: 'ORD-TEST-1-L002',
          orl_ord_id: 'ORD-TEST-1',
          orl_pg_id: '9002',
          orl_art_ref: 'REF LUK 1',
          orl_pm_id: null,
          orl_pm_name: 'LUK',
          orl_orls_id: null,
        },
        // Ligne ancienne : son orl_pm_id (marque sans lien) prime sur la pièce.
        {
          orl_id: 'ORD-TEST-1-L003',
          orl_ord_id: 'ORD-TEST-1',
          orl_pg_id: '9003',
          orl_art_ref: 'REF AUTRE 1',
          orl_pm_id: '777',
          orl_pm_name: 'AUTRE',
          orl_orls_id: null,
        },
      ],
      pieces: [
        { piece_id: 9001, piece_pm_id: 4200 },
        { piece_id: 9002, piece_pm_id: 2860 },
        { piece_id: 9003, piece_pm_id: 4200 },
      ],
      ___xtr_supplier_link_pm: [
        {
          slpm_id: '1',
          slpm_spl_id: '19',
          slpm_pm_id: '1080',
          slpm_display: '1',
        },
        ...liens.map((l, i) => ({
          slpm_id: String(2 + i),
          slpm_spl_id: l.spl,
          slpm_pm_id: l.pm,
          slpm_display: '1',
        })),
      ],
    });
    const repo = new SupplierTruthRepository(cfg);
    (repo as unknown as { supabase: unknown }).supabase = db.client;
    const lireLot = jest.fn(async (splId: string, demandes: DemandeLecture[]) =>
      demandes.map(
        (d): ResultatLecture => ({
          ok: true,
          source: 'PORTAIL',
          splId,
          plateforme: splId === '19' ? 'cal' : 'inoshop',
          refDemandee: d.ref,
          refFournisseur: d.ref,
          correspondance: 'EXACTE',
          prixPublicHt: 40,
          remisePct: 50,
          remise2Pct: null,
          prixNetHt: 20,
          disponible: true,
          delaiJours: null,
          detailDispo: 'disponible',
          lueA: '2026-11-18T16:00:00.000Z',
        }),
      ),
    );
    const runner = new SupplierOfferReleveRunner(
      repo,
      { lireLot } as unknown as SupplierLiveQuoteService,
      jest.fn(),
      50,
      () => [CAL, DCA],
    );
    return { runner, lireLot, inseres: db.inseres };
  }

  it('la migration porte exactement les quatre liens DCA/CAL ↔ SEIM/LUK', () => {
    expect(liensMigration()).toEqual([
      { spl: '71', pm: '4200' },
      { spl: '71', pm: '2860' },
      { spl: '19', pm: '4200' },
      { spl: '19', pm: '2860' },
    ]);
  });

  it('avant : aucun relevé pour SEIM ni LUK', async () => {
    const { runner, lireLot, inseres } = scenario([]);
    const r = await runner.runReleve();
    expect(lireLot).not.toHaveBeenCalled();
    expect(inseres).toEqual([]);
    expect(r).toMatchObject({ lignes: 3, fournisseursSansMarque: 2 });
  });

  it('après : DCA et CAL relèvent la ligne SEIM et la ligne LUK, la ligne ancienne garde sa marque', async () => {
    const { runner, lireLot, inseres } = scenario(liensMigration());
    const r = await runner.runReleve();
    const attendu = [
      { ref: 'REF SEIM 1', marque: 'SEIM' },
      { ref: 'REF LUK 1', marque: 'LUK' },
    ];
    expect(lireLot).toHaveBeenCalledWith('19', attendu);
    expect(lireLot).toHaveBeenCalledWith('71', attendu);
    expect(
      inseres.map((o) => [o.supplier_id, o.piece_id_i, o.achat_ht_cents]),
    ).toEqual([
      ['19', 9001, 2000],
      ['19', 9002, 2000],
      ['71', 9001, 2000],
      ['71', 9002, 2000],
    ]);
    expect(r).toMatchObject({
      lignes: 3,
      relevesEcrits: 4,
      fournisseursLus: 2,
    });
  });
});
