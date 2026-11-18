import type { LectureLive } from './supplier-live-quote.service';
import {
  FRAICHEUR_RELEVE_MAX_MINUTES,
  MOTIF_RELEVE_ABSENT,
  MOTIF_RELEVE_PERIME,
  lectureDepuisReleve,
  offreDepuisLecture,
  releveEstFrais,
} from './supplier-offer-releve';
import type { OffreReleve } from './supplier-truth.repository';

/** Complément BK n° 4 — données synthétiques uniquement (dépôt public). */

const MAINTENANT = new Date('2026-11-18T10:00:00.000Z');

const RELEVE: OffreReleve = {
  supplier_id: '71',
  supplier_ref: 'REF-TEST-1',
  public_ht_cents: 5000,
  remise_pct: 40,
  achat_ht_cents: 3000,
  available: true,
  delay_days: null,
  parse_confidence: 'HIGH_CONFIDENCE',
  observed_at: '2026-11-18T09:45:00.000Z',
};

const LECTURE: LectureLive = {
  ok: true,
  source: 'PORTAIL',
  splId: '71',
  plateforme: 'inoshop',
  refDemandee: 'REF TEST 1',
  refFournisseur: 'REF-TEST-1',
  correspondance: 'EXACTE',
  prixPublicHt: 50,
  remisePct: 40,
  remise2Pct: 10,
  prixNetHt: 27,
  disponible: true,
  delaiJours: null,
  detailDispo: 'CONFIRMED_AG (ag)',
  lueA: '2026-11-18T09:45:00.000Z',
};

describe('fraîcheur du relevé', () => {
  it('constante nommée : 30 min, motifs exacts', () => {
    expect(FRAICHEUR_RELEVE_MAX_MINUTES).toBe(30);
    expect(MOTIF_RELEVE_ABSENT).toBe('relevé absent');
    expect(MOTIF_RELEVE_PERIME).toBe('relevé de plus de 30 min');
  });

  it.each([
    ['29 min 59 s', '2026-11-18T09:30:01.000Z', true],
    ['30 min pile', '2026-11-18T09:30:00.000Z', true],
    ['30 min 01 s', '2026-11-18T09:29:59.000Z', false],
    ['date illisible', 'pas une date', false],
  ])('%s ⇒ frais = %s', (_cas, observeA, attendu) => {
    expect(releveEstFrais(observeA, MAINTENANT)).toBe(attendu);
  });
});

describe('lectureDepuisReleve (PROD : aucun portail)', () => {
  it('absent ⇒ RELEVE_ABSENT « relevé absent »', () => {
    expect(lectureDepuisReleve(null, '71', 'X', MAINTENANT)).toEqual({
      ok: false,
      splId: '71',
      motif: 'RELEVE_ABSENT',
      detail: 'relevé absent',
      lueA: MAINTENANT.toISOString(),
    });
  });

  it('30 min 01 s ⇒ RELEVE_PERIME « relevé de plus de 30 min », date du relevé', () => {
    const r = lectureDepuisReleve(
      { ...RELEVE, observed_at: '2026-11-18T09:29:59.000Z' },
      '71',
      'X',
      MAINTENANT,
    );
    expect(r).toEqual({
      ok: false,
      splId: '71',
      motif: 'RELEVE_PERIME',
      detail: 'relevé de plus de 30 min',
      lueA: '2026-11-18T09:29:59.000Z',
    });
  });

  it('frais ⇒ lecture source RELEVE, euros, disponibilité', () => {
    expect(
      lectureDepuisReleve(RELEVE, '71', 'REF TEST 1', MAINTENANT),
    ).toMatchObject({
      ok: true,
      source: 'RELEVE',
      splId: '71',
      plateforme: 'inoshop',
      refDemandee: 'REF TEST 1',
      refFournisseur: 'REF-TEST-1',
      correspondance: 'EXACTE',
      prixPublicHt: 50,
      remisePct: 40,
      prixNetHt: 30,
      disponible: true,
      detailDispo: 'disponible',
      lueA: '2026-11-18T09:45:00.000Z',
    });
  });

  it('référence introuvable au relevé ⇒ jamais disponible', () => {
    expect(
      lectureDepuisReleve(
        { ...RELEVE, parse_confidence: 'UNKNOWN', available: true },
        '71',
        'X',
        MAINTENANT,
      ),
    ).toMatchObject({
      ok: true,
      correspondance: 'ABSENTE',
      disponible: false,
      detailDispo: 'introuvable',
    });
  });

  it('sur commande ⇒ délai affiché', () => {
    expect(
      lectureDepuisReleve(
        { ...RELEVE, available: false, delay_days: 3 },
        '19',
        'X',
        MAINTENANT,
      ),
    ).toMatchObject({
      disponible: false,
      plateforme: 'cal',
      detailDispo: 'sur commande, délai 3 j',
    });
  });
});

describe('offreDepuisLecture (DEV : écriture du relevé)', () => {
  it('centimes, remise en cascade, confiance, date de lecture', () => {
    expect(offreDepuisLecture(LECTURE, 42)).toEqual({
      piece_id_i: 42,
      supplier_id: '71',
      supplier_ref: 'REF-TEST-1',
      public_ht_cents: 5000,
      remise_pct: 46,
      achat_ht_cents: 2700,
      available: true,
      delay_days: null,
      parse_confidence: 'HIGH_CONFIDENCE',
      source_verified_at: '2026-11-18T09:45:00.000Z',
      observed_at: '2026-11-18T09:45:00.000Z',
    });
  });

  it('référence non exacte ⇒ AMBIGUOUS_MAPPING ; absente ⇒ UNKNOWN', () => {
    expect(
      offreDepuisLecture({ ...LECTURE, correspondance: 'NON_EXACTE' }, 1)
        .parse_confidence,
    ).toBe('AMBIGUOUS_MAPPING');
    const absente = offreDepuisLecture(
      {
        ...LECTURE,
        correspondance: 'ABSENTE',
        refFournisseur: null,
        prixNetHt: null,
      },
      1,
    );
    expect(absente).toMatchObject({
      parse_confidence: 'UNKNOWN',
      supplier_ref: 'REF TEST 1',
      achat_ht_cents: null,
    });
  });

  it('aller-retour : un relevé écrit à l’instant est relu frais et identique', () => {
    const o = offreDepuisLecture(
      { ...LECTURE, remise2Pct: 0, prixNetHt: 30 },
      42,
    );
    const relu = lectureDepuisReleve(
      {
        supplier_id: o.supplier_id,
        supplier_ref: o.supplier_ref,
        public_ht_cents: o.public_ht_cents,
        remise_pct: o.remise_pct,
        achat_ht_cents: o.achat_ht_cents,
        available: o.available,
        delay_days: o.delay_days,
        parse_confidence: o.parse_confidence,
        observed_at: o.observed_at as string,
      },
      '71',
      'REF TEST 1',
      MAINTENANT,
    );
    expect(relu).toMatchObject({ ok: true, prixNetHt: 30, remisePct: 40 });
  });
});
