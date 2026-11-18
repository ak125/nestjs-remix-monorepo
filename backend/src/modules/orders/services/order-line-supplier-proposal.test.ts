import {
  proposerFournisseur,
  PROCEDURE_RUPTURE,
  type FournisseurAnnuaire,
  type OffreTarif,
  type ReleveCandidat,
} from './order-line-supplier-proposal';

const annuaire = new Map<string, FournisseurAnnuaire>([
  ['ACR', { splId: '3', nom: 'ACR' }],
  ['DCA', { splId: '71', nom: 'DCA' }],
  ['SASIC', { splId: '59', nom: 'SASIC' }],
]);

const offre = (o: Partial<OffreTarif> = {}): OffreTarif => ({
  libelleFournisseur: 'ACR',
  achatHt: 10,
  venteHt: 15,
  tauxTva: 0.2,
  type: '0',
  ...o,
});

const ligne = { quantite: '2', venteUnitTtc: '18.00' };

describe('proposerFournisseur (décision 50)', () => {
  it('aucune offre vendable → RUPTURE avec la procédure', () => {
    expect(proposerFournisseur([], annuaire, ligne)).toEqual({
      statut: 'RUPTURE',
      offresVendables: 0,
      procedure: PROCEDURE_RUPTURE,
    });
  });

  it('retient le plus petit prix d’achat et calcule le total par quantité', () => {
    const p = proposerFournisseur(
      [
        offre({ libelleFournisseur: 'ACR', achatHt: 11.5 }),
        offre({ libelleFournisseur: 'dca ', achatHt: '9.333', type: '1' }),
      ],
      annuaire,
      ligne,
    );
    expect(p).toMatchObject({
      statut: 'PROPOSE',
      splId: '71',
      nomFournisseur: 'DCA',
      prixAchatUnitHt: 9.33,
      quantite: 2,
      prixAchatHt: 18.67,
      tauxTva: 0.2,
      offresVendables: 2,
      offresEcartees: [],
    });
  });

  it('égalité de prix → ordre alphabétique du libellé (stable)', () => {
    const p = proposerFournisseur(
      [
        offre({ libelleFournisseur: 'SASIC' }),
        offre({ libelleFournisseur: 'ACR' }),
      ],
      annuaire,
      ligne,
    );
    expect(p).toMatchObject({ statut: 'PROPOSE', splId: '3' });
  });

  it('écarte prix d’achat absent, fournisseur inconnu, perte au tarif', () => {
    const p = proposerFournisseur(
      [
        offre({ achatHt: null }),
        offre({ achatHt: 0 }),
        offre({ libelleFournisseur: 'RCA France' }),
        offre({ libelleFournisseur: null }),
        offre({ venteHt: 9 }),
      ],
      annuaire,
      ligne,
    );
    expect(p.statut).toBe('A_COMPLETER');
    if (p.statut !== 'A_COMPLETER') return;
    expect(p.offresVendables).toBe(5);
    expect(p.offresEcartees.map((e) => e.motif)).toEqual([
      'PRIX_ACHAT_ABSENT',
      'PRIX_ACHAT_ABSENT',
      'FOURNISSEUR_INCONNU',
      'FOURNISSEUR_INCONNU',
      'VENTE_A_PERTE_TARIF',
    ]);
  });

  it('jamais à perte au prix payé : vente unitaire TTC / (1+TVA) < achat → écartée', () => {
    // 11.40 TTC / 1.2 = 9.50 HT < 10 HT d'achat
    const p = proposerFournisseur([offre()], annuaire, {
      quantite: 1,
      venteUnitTtc: 11.4,
    });
    expect(p).toMatchObject({
      statut: 'A_COMPLETER',
      offresEcartees: [{ motif: 'VENTE_A_PERTE_LIGNE' }],
    });
  });

  it('la perte au prix payé écarte une offre mais laisse passer la suivante', () => {
    const p = proposerFournisseur(
      [
        offre({ achatHt: 10 }),
        offre({ libelleFournisseur: 'DCA', achatHt: 12 }),
      ],
      annuaire,
      { quantite: 1, venteUnitTtc: 12 }, // 10 HT payé
    );
    expect(p).toMatchObject({
      statut: 'PROPOSE',
      splId: '3',
      prixAchatUnitHt: 10,
    });
    const p2 = proposerFournisseur(
      [
        offre({ achatHt: 10.5 }),
        offre({ libelleFournisseur: 'DCA', achatHt: 9 }),
      ],
      annuaire,
      { quantite: 1, venteUnitTtc: 12 },
    );
    expect(p2).toMatchObject({ statut: 'PROPOSE', splId: '71' });
  });

  it('TVA inconnue alors que le prix payé est connu → écartée', () => {
    const p = proposerFournisseur([offre({ tauxTva: null })], annuaire, ligne);
    expect(p).toMatchObject({
      statut: 'A_COMPLETER',
      offresEcartees: [{ motif: 'TVA_INCONNUE' }],
    });
  });

  it('prix payé absent : seule la règle du tarif s’applique', () => {
    const p = proposerFournisseur([offre({ tauxTva: null })], annuaire, {
      quantite: 1,
      venteUnitTtc: '',
    });
    expect(p).toMatchObject({ statut: 'PROPOSE', splId: '3', tauxTva: null });
  });

  it('quantité illisible, nulle ou fractionnaire → A_COMPLETER, jamais devinée', () => {
    for (const quantite of [null, '', '0', '-2', '1.5', 'abc']) {
      const p = proposerFournisseur([offre()], annuaire, {
        quantite,
        venteUnitTtc: null,
      });
      expect(p).toEqual({
        statut: 'A_COMPLETER',
        offresVendables: 1,
        offresEcartees: [],
        motifLigne: 'QUANTITE_ILLISIBLE',
      });
    }
  });

  it('rupture prime sur une quantité illisible', () => {
    expect(
      proposerFournisseur([], annuaire, { quantite: null, venteUnitTtc: null })
        .statut,
    ).toBe('RUPTURE');
  });
});

describe('proposerFournisseur — relevé frais ou date du tarif (complément BK n° 4)', () => {
  // Données synthétiques : aucune pièce, aucun prix réel.
  const releve = (r: Partial<ReleveCandidat> = {}): ReleveCandidat => ({
    splId: '71',
    achatHt: 8,
    disponible: true,
    exacte: true,
    frais: true,
    observeA: '2026-11-18T09:50:00.000Z',
    ...r,
  });
  const tarif = [offre({ achatHt: 10, dateTarif: '2022-07-01T00:00:00.000Z' })];

  it('retient la meilleure offre disponible du relevé frais', () => {
    const p = proposerFournisseur(tarif, annuaire, ligne, [
      releve({ splId: '3', achatHt: 9.5 }),
      releve({ splId: '71', achatHt: 8 }),
    ]);
    expect(p).toMatchObject({
      statut: 'PROPOSE',
      splId: '71',
      nomFournisseur: 'DCA',
      prixAchatUnitHt: 8,
      prixAchatHt: 16,
      tauxTva: 0.2,
      origine: { type: 'RELEVE', observeA: '2026-11-18T09:50:00.000Z' },
    });
  });

  it.each([
    ['périmé', { frais: false }],
    ['indisponible', { disponible: false }],
    ['référence non exacte', { exacte: false }],
    ['prix non lu', { achatHt: null }],
    ['fournisseur hors annuaire', { splId: '999' }],
    ['vente à perte au prix payé', { achatHt: 15.01 }], // 18 TTC → 15 HT
  ] as [string, Partial<ReleveCandidat>][])(
    'relevé %s : ignoré, proposition au tarif datée',
    (_cas, over) => {
      const p = proposerFournisseur(tarif, annuaire, ligne, [releve(over)]);
      expect(p).toMatchObject({
        statut: 'PROPOSE',
        splId: '3',
        prixAchatUnitHt: 10,
        origine: { type: 'TARIF', dateTarif: '2022-07-01T00:00:00.000Z' },
      });
    },
  );

  it('sans relevé : tarif avec sa date, jamais présenté comme actuel', () => {
    expect(proposerFournisseur(tarif, annuaire, ligne)).toMatchObject({
      origine: { type: 'TARIF', dateTarif: '2022-07-01T00:00:00.000Z' },
    });
    expect(proposerFournisseur([offre()], annuaire, ligne)).toMatchObject({
      origine: { type: 'TARIF', dateTarif: null },
    });
  });

  it('TVA du tarif ambiguë : relevé non retenu (marge non vérifiable)', () => {
    const p = proposerFournisseur(
      [...tarif, offre({ libelleFournisseur: 'SASIC', tauxTva: 0.055 })],
      annuaire,
      ligne,
      [releve()],
    );
    expect(p).toMatchObject({ origine: { type: 'TARIF' } });
  });

  it('aucune offre au tarif : RUPTURE reste, même avec un relevé', () => {
    expect(proposerFournisseur([], annuaire, ligne, [releve()]).statut).toBe(
      'RUPTURE',
    );
  });
});
