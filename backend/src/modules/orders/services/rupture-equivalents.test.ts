/**
 * Mandat CL — équivalents d'une ligne en rupture. Données entièrement
 * inventées (marques, références, identifiants, montants) : le cas « FREINO →
 * PLAQUEX » reconstruit la forme du cas du 16/11 (même type véhicule, mêmes
 * références d'origine, dimensions à 0,1 mm près, prix aligné) sans aucune
 * donnée client ni donnée de commande réelle.
 */
import {
  classerEquivalents,
  comparerCriteres,
  preuveReference,
  recherchesCandidats,
  roleCritere,
  texteMailEquivalent,
  typeVehiculeDepuisUrl,
  MAX_EQUIVALENTS_AFFICHES,
  TOLERANCE_DIMENSION_MM,
  type CritereLu,
  type DefinitionCritere,
  type OffreEquivalent,
  type PieceCandidate,
  type PieceCommandee,
  type RefCatalogue,
} from './rupture-equivalents';
import type { FournisseurAnnuaire } from './order-line-supplier-proposal';

// ─── Fixtures inventées ──────────────────────────────────────────────────────

const GAMME = 7001;
const TYPE = 99001;
const URL_R2 = `/pieces/plaquette-de-frein-${GAMME}/marque-auto-501/modele-x-w900-60123/x-200-diesel-${TYPE}.html`;

const def = (
  criId: string,
  libelle: string,
  unite: string | null,
  type: string,
): [string, DefinitionCritere] => [criId, { criId, libelle, unite, type }];

const DEFINITIONS = new Map<string, DefinitionCritere>([
  def('11', 'Largeur', 'mm', '1'),
  def('12', 'Hauteur 1', 'mm', '1'),
  def('13', 'Hauteur 2', 'mm', '1'),
  def('14', 'Épaisseur', 'mm', '1'),
  def('15', 'Nombre de vis', '', '1'),
  def('21', 'Indicateur d’usure', '', '3'),
  def('22', 'Info complémentaire', '', '3'),
  def('23', 'Info complémentaire', '', '3'),
  def('31', 'Système de freinage', '', '2'),
  def('32', 'Marque de conformité', '', '2'),
  def('41', 'Poids', 'kg', '1'),
  def('42', 'Longueur', 'cm', '1'),
  def('51', 'Dans le sens de la marche', '', '5'),
]);

const cri = (criId: string, valeur: string): CritereLu => ({ criId, valeur });
const ref = (kind: string, search: string, affiche = search): RefCatalogue => ({
  kind,
  search,
  ref: affiche,
});

const CRITERES_COMMANDEE: CritereLu[] = [
  cri('11', '120,1'),
  cri('12', '61,8'),
  cri('13', '55,1'),
  cri('14', '18,8'),
  cri('15', '4'),
  cri('21', 'contact exclu'),
  cri('21', 'préparé pour indicateur'),
  cri('22', 'avec accessoires'),
  cri('23', 'avec vis'),
  cri('31', 'Systeme-A / Systeme-B'),
  cri('32', 'E0 00R-0000/01'),
];

const COMMANDEE: PieceCommandee = {
  pieceId: 9000001,
  gammeId: GAMME,
  refs: [
    ref('1', 'FR000011', 'FR 00.0001-1'),
    ref('3', 'OE111', 'OE 111'),
    ref('3', 'OE222', 'OE 222'),
    ref('4', 'PX7777'),
    ref('4', 'AUTRE1'),
  ],
  criteres: CRITERES_COMMANDEE,
};

const ANNUAIRE = new Map<string, FournisseurAnnuaire>([
  ['DCX', { splId: '12', nom: 'DCX DISTRIBUTION' }],
  ['PAX', { splId: '7', nom: 'PAX PIECES' }],
]);

const offre = (o: Partial<OffreEquivalent> = {}): OffreEquivalent => ({
  libelleFournisseur: 'DCX',
  achatHt: 24.21,
  venteHt: 36.85,
  tauxTva: 0.2,
  type: '0',
  venteTtc: 54.38,
  consigneTtc: 0,
  dateTarif: '2022-06-01T00:00:00.000Z',
  ...o,
});

/** L'équivalent du cas inventé : dimensions à 0,1 mm, mêmes OE, cité par la commandée. */
const PLAQUEX = (o: Partial<PieceCandidate> = {}): PieceCandidate => ({
  pieceId: 9000002,
  ref: 'PX 7777',
  marque: 'PLAQUEX',
  gammeId: GAMME,
  affichee: true,
  refs: [ref('1', 'PX7777', 'PX 7777'), ref('3', 'OE111'), ref('3', 'OE222')],
  criteres: [
    cri('11', '120,2'),
    cri('12', '61,8'),
    cri('13', '55'),
    cri('14', '18,8'),
    cri('21', 'préparé pour indicateur'),
    cri('22', 'avec accessoires'),
    cri('23', 'avec vis'),
    cri('31', 'Systeme-A'),
    cri('41', '1,9'),
    cri('42', '17'),
    cri('51', '0'),
  ],
  couvreTypeLigne: true,
  offres: [offre()],
  ...o,
});

const LIGNE = { quantite: '1', venteUnitTtc: '54.38', totalPayeTtc: 54.38 };
const typeLigne = typeVehiculeDepuisUrl(URL_R2)!;

// ─── Type véhicule ───────────────────────────────────────────────────────────

describe('typeVehiculeDepuisUrl', () => {
  it('lit le type de la page R2, relative ou absolue', () => {
    expect(typeVehiculeDepuisUrl(URL_R2)).toEqual({
      typeId: TYPE,
      marque: 'marque-auto',
      modele: 'modele-x-w900',
      motorisation: 'x-200-diesel',
    });
    expect(
      typeVehiculeDepuisUrl(`https://www.exemple.test${URL_R2}?utm=1#haut`)
        ?.typeId,
    ).toBe(TYPE);
  });

  it('ne devine jamais : recherche, page sans véhicule, id absent → null', () => {
    expect(typeVehiculeDepuisUrl('/search/?q=OE111')).toBeNull();
    expect(typeVehiculeDepuisUrl('/find/OE111')).toBeNull();
    expect(typeVehiculeDepuisUrl('System')).toBeNull();
    expect(
      typeVehiculeDepuisUrl('/pieces/plaquette-7001/a-1/b-2/c-sans-id.html'),
    ).toBeNull();
    expect(typeVehiculeDepuisUrl(null)).toBeNull();
    expect(typeVehiculeDepuisUrl('')).toBeNull();
  });
});

// ─── Référence croisée ───────────────────────────────────────────────────────

describe('preuveReference', () => {
  it('retient les OE communes et la citation dans les deux sens (liens asymétriques)', () => {
    expect(preuveReference(COMMANDEE.refs, PLAQUEX().refs)).toEqual({
      oemCommunes: ['OE 111', 'OE 222'],
      citeeParCommandee: true,
      citeCommandee: false,
    });
    // le candidat cite la commandée, sans OE commune
    expect(
      preuveReference(COMMANDEE.refs, [ref('1', 'ZZ1'), ref('4', 'FR000011')]),
    ).toEqual({
      oemCommunes: [],
      citeeParCommandee: false,
      citeCommandee: true,
    });
  });

  it('une même chaîne dans des sortes différentes ne prouve rien', () => {
    // OE111 du candidat est une réf « autre marque » (4), pas une OE (3)
    expect(
      preuveReference(COMMANDEE.refs, [ref('1', 'ZZ1'), ref('4', 'OE111')]),
    ).toBeNull();
  });

  it('les recherches couvrent réf propre, OE et réfs citées, sans doublon', () => {
    expect(recherchesCandidats(COMMANDEE.refs)).toEqual([
      'AUTRE1',
      'FR000011',
      'OE111',
      'OE222',
      'PX7777',
    ]);
  });
});

// ─── Critères ────────────────────────────────────────────────────────────────

describe('comparerCriteres', () => {
  it('cas inventé : dimensions à 0,1 mm (PROCHE), listes incluses, informatifs à part', () => {
    const r = comparerCriteres(
      CRITERES_COMMANDEE,
      PLAQUEX().criteres,
      DEFINITIONS,
    );
    expect(r.compatible).toBe(true);
    const v = Object.fromEntries(r.compares.map((c) => [c.criId, c.verdict]));
    expect(v).toEqual({
      '11': 'PROCHE',
      '12': 'IDENTIQUE',
      '13': 'PROCHE',
      '14': 'IDENTIQUE',
      '21': 'PROCHE',
      '22': 'IDENTIQUE',
      '23': 'IDENTIQUE',
      '31': 'PROCHE',
    });
    expect(r.compares.find((c) => c.criId === '31')?.bloquant).toBe(false);
    expect(r.ecartTotalMm).toBe(0.2);
    expect(r.aVerifier).toBe(0);
    expect(r.nonCompares.map((c) => [c.criId, c.renseigne, c.motif])).toEqual([
      ['15', 'COMMANDEE', 'UN_SEUL_COTE'],
      ['32', 'COMMANDEE', 'UN_SEUL_COTE'],
      ['41', 'EQUIVALENT', 'NON_PRINCIPAL'],
      ['42', 'EQUIVALENT', 'NON_PRINCIPAL'],
      ['51', 'EQUIVALENT', 'NON_PRINCIPAL'],
    ]);
  });

  it(`au-delà de ${TOLERANCE_DIMENSION_MM} mm la dimension est DIFFERENTE`, () => {
    const r = comparerCriteres(
      [cri('11', '120,1')],
      [cri('11', '120,7')],
      DEFINITIONS,
    );
    expect(r.compares[0]).toMatchObject({ verdict: 'DIFFERENT', ecartMm: 0.6 });
    expect(r.compatible).toBe(false);
    // exactement la tolérance : encore PROCHE
    expect(
      comparerCriteres([cri('11', '120,1')], [cri('11', '120,6')], DEFINITIONS)
        .compares[0].verdict,
    ).toBe('PROCHE');
  });

  it('nombre sans unité : égalité stricte ; valeur listée disjointe : bloquante', () => {
    expect(
      comparerCriteres([cri('15', '4')], [cri('15', '2')], DEFINITIONS)
        .compatible,
    ).toBe(false);
    expect(
      comparerCriteres(
        [cri('11', '120'), cri('22', 'avec accessoires')],
        [cri('11', '120'), cri('22', 'sans accessoires')],
        DEFINITIONS,
      ).compatible,
    ).toBe(false);
  });

  it('un critère informatif différent ne bloque pas mais est compté à vérifier', () => {
    const r = comparerCriteres(
      [cri('11', '120'), cri('31', 'Systeme-A')],
      [cri('11', '120'), cri('31', 'Systeme-C')],
      DEFINITIONS,
    );
    expect(r.compatible).toBe(true);
    expect(r.aVerifier).toBe(1);
  });

  it('sans critère bloquant commun, pas de compatibilité', () => {
    expect(
      comparerCriteres([cri('31', 'A')], [cri('31', 'A')], DEFINITIONS)
        .compatible,
    ).toBe(false);
  });

  it('rôles : poids et conditionnement hors comparaison, type 2 informatif', () => {
    expect(roleCritere(DEFINITIONS.get('11'))).toBe('BLOQUANT');
    expect(roleCritere(DEFINITIONS.get('21'))).toBe('BLOQUANT');
    expect(roleCritere(DEFINITIONS.get('31'))).toBe('INFORMATIF');
    expect(roleCritere(DEFINITIONS.get('41'))).toBeNull();
    expect(roleCritere(DEFINITIONS.get('42'))).toBeNull();
    expect(roleCritere(DEFINITIONS.get('51'))).toBeNull();
    expect(roleCritere(undefined)).toBeNull();
  });
});

// ─── Classement ──────────────────────────────────────────────────────────────

const classer = (candidats: PieceCandidate[]) =>
  classerEquivalents(
    COMMANDEE,
    typeLigne,
    LIGNE,
    candidats,
    DEFINITIONS,
    ANNUAIRE,
  );

describe('classerEquivalents', () => {
  it('cas FREINO → PLAQUEX : retenable au prix payé, marge, aucun supplément', () => {
    const r = classer([PLAQUEX()]);
    expect(r.equivalents).toHaveLength(1);
    const e = r.equivalents[0];
    expect(e).toMatchObject({
      pieceId: 9000002,
      marque: 'PLAQUEX',
      ref: 'PX 7777',
      statut: 'RETENABLE',
      supplementTtc: 0,
      venteSiteUnitTtc: 54.38,
      achat: {
        splId: '12',
        fournisseur: 'DCX DISTRIBUTION',
        libelleFournisseur: 'DCX',
        prixAchatUnitHt: 24.21,
        prixAchatHt: 24.21,
        quantite: 1,
        tauxTva: 0.2,
        origine: { type: 'TARIF', dateTarif: '2022-06-01T00:00:00.000Z' },
      },
      preuve: { typeVehicule: TYPE },
    });
    // 54,38 TTC payé → 45,32 HT ; 45,32 − 24,21 = 21,11
    expect(e.margeAuPrixPaye).toEqual({
      unitHt: 21.11,
      totalHt: 21.11,
      taux: 0.466,
    });
    expect(r.ecartes).toEqual({});
  });

  it('écarte et compte : gamme, affichage, type véhicule, critères, dispo, consigne', () => {
    const r = classer([
      PLAQUEX({ pieceId: 1, gammeId: 7002 }),
      PLAQUEX({ pieceId: 2, affichee: false }),
      PLAQUEX({ pieceId: 3, couvreTypeLigne: false }),
      PLAQUEX({ pieceId: 4, criteres: [cri('11', '135')] }),
      PLAQUEX({ pieceId: 5, criteres: [cri('31', 'Systeme-A')] }),
      PLAQUEX({ pieceId: 6, offres: [] }),
      PLAQUEX({
        pieceId: 7,
        offres: [offre({ libelleFournisseur: 'INCONNU' })],
      }),
      PLAQUEX({ pieceId: 8, offres: [offre({ consigneTtc: 12 })] }),
      // aucune référence croisée : pas un candidat, pas compté
      PLAQUEX({ pieceId: 9, refs: [ref('1', 'ZZ9')] }),
      // la pièce commandée elle-même n'est jamais son propre équivalent
      PLAQUEX({ pieceId: COMMANDEE.pieceId }),
    ]);
    expect(r.equivalents).toEqual([]);
    expect(r.ecartes).toEqual({
      GAMME_DIFFERENTE: 1,
      NON_AFFICHEE: 1,
      TYPE_VEHICULE_NON_COUVERT: 1,
      CRITERES_DIFFERENTS: 1,
      CRITERES_NON_COMPARABLES: 1,
      INDISPONIBLE: 1,
      OFFRE_INCOMPLETE: 1,
      CONSIGNE: 1,
    });
    expect(r.motifsAchat).toEqual({ FOURNISSEUR_INCONNU: 1 });
  });

  it('jamais à perte : plus cher que le prix payé → SUPPLEMENT_REQUIS avec le montant', () => {
    const r = classer([
      PLAQUEX({
        pieceId: 20,
        offres: [offre({ achatHt: 50, venteHt: 60, venteTtc: 72 })],
      }),
    ]);
    expect(r.equivalents[0]).toMatchObject({
      statut: 'SUPPLEMENT_REQUIS',
      supplementTtc: 17.62,
      achat: { prixAchatUnitHt: 50 },
    });
    expect(r.equivalents[0].margeAuPrixPaye?.unitHt).toBeLessThan(0);
  });

  it('à perte même au tarif du site : jamais proposé', () => {
    const r = classer([
      PLAQUEX({ pieceId: 21, offres: [offre({ achatHt: 50, venteHt: 40 })] }),
    ]);
    expect(r.equivalents).toEqual([]);
    expect(r.motifsAchat).toEqual({ VENTE_A_PERTE_TARIF: 1 });
  });

  it('classe : retenable d’abord, puis preuve la plus directe, puis écart, puis achat', () => {
    const oeSeules = [ref('1', 'ZZ'), ref('3', 'OE111')];
    const r = classer([
      PLAQUEX({
        pieceId: 30,
        offres: [offre({ achatHt: 50, venteHt: 60, venteTtc: 72 })],
      }),
      PLAQUEX({
        pieceId: 31,
        refs: oeSeules,
        offres: [offre({ achatHt: 20 })],
      }),
      PLAQUEX({
        pieceId: 32,
        refs: oeSeules,
        offres: [offre({ achatHt: 19 })],
      }),
      PLAQUEX({ pieceId: 33 }),
    ]);
    expect(r.equivalents.map((e) => e.pieceId)).toEqual([33, 32, 31, 30]);
  });

  it(`tronque au-delà de ${MAX_EQUIVALENTS_AFFICHES} et le dit`, () => {
    const r = classer(
      Array.from({ length: 13 }, (_, i) => PLAQUEX({ pieceId: 100 + i })),
    );
    expect(r.equivalents).toHaveLength(MAX_EQUIVALENTS_AFFICHES);
    expect(r.tronques).toBe(3);
  });
});

// ─── Texte du mail ───────────────────────────────────────────────────────────

describe('texteMailEquivalent', () => {
  const ctx = (e = classer([PLAQUEX()]).equivalents[0]) => ({
    orderId: 'CMD-TEST-1',
    marqueCommandee: 'FREINO',
    refCommandee: 'FR 00.0001-1',
    quantite: 1,
    equivalent: e,
    type: typeLigne,
  });

  it('propose l’équivalent et demande l’immatriculation ou la référence d’origine', () => {
    const { objet, corps } = texteMailEquivalent(ctx());
    expect(objet).toBe(
      'Votre commande CMD-TEST-1 : une solution disponible tout de suite',
    );
    expect(corps).toContain('1 × FREINO FR 00.0001-1');
    expect(corps).toContain('PLAQUEX PX 7777');
    expect(corps).toContain(
      "mêmes références d'origine constructeur (OE 111, OE 222)",
    );
    expect(corps).toContain(
      '- Largeur : 120,2 mm (pièce commandée : 120,1 mm)',
    );
    expect(corps).toContain('- Épaisseur : 18,8 mm');
    expect(corps).toContain('MARQUE AUTO MODELE X W900 X 200 DIESEL');
    expect(corps).toContain(
      "l'immatriculation du véhicule ou la référence d'origine constructeur",
    );
    expect(corps).toContain('aucun supplément, aucun remboursement');
    expect(corps).toContain(
      'nous annulons la commande et vous remboursons intégralement',
    );
    // informatif (système) et prix d'achat jamais dans le mail
    expect(corps).not.toContain('Systeme');
    expect(corps).not.toContain('24,21');
    expect(corps).not.toContain('DCX');
  });

  it('supplément : montant affiché, décision laissée à Marwane', () => {
    const e = classer([
      PLAQUEX({ offres: [offre({ achatHt: 50, venteHt: 60, venteTtc: 72 })] }),
    ]).equivalents[0];
    const { corps } = texteMailEquivalent(ctx(e));
    expect(corps).toContain('17,62 € de plus');
    expect(corps).toContain('[À COMPLÉTER');
  });
});
