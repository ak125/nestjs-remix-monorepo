import type { SupplierConnectorConfig } from './connectors/supplier-registry';
import type {
  DemandeLecture,
  ResultatLecture,
  SupplierLiveQuoteService,
} from './supplier-live-quote.service';
import { SupplierOfferReleveRunner } from './supplier-offer-releve.runner';
import type {
  LigneAReleve,
  OfferSnapshotInsert,
  SupplierTruthRepository,
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
