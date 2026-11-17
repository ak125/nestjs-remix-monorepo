import {
  proposerFournisseur,
  PROCEDURE_RUPTURE,
  type FournisseurAnnuaire,
  type OffreTarif,
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
