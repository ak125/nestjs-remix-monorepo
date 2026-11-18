import {
  FRAICHEUR_RELEVE_MAX_MINUTES,
  lectureDepuisReleve,
  type LectureLive,
} from '../../supplier-truth';
import type { PropositionFournisseur } from './order-line-supplier-proposal';
import {
  evaluerControles,
  type EntreeControles,
  type ResultatControle,
} from './supplier-order-controls';

const PROPOSE: PropositionFournisseur = {
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

/** Cas nominal : tout passe ; chaque test dégrade un seul fait. */
function entree(over: Partial<EntreeControles> = {}): EntreeControles {
  return {
    commande: { estPayee: true, statut: '1' },
    ligne: { quantite: '2', venteUnitTtc: '54.00', statut: '1' },
    proposition: PROPOSE,
    lecture: LIVE,
    demande: { compatibiliteVerifiee: true, confirmationPlafond: false },
    dejaPreparee: false,
    essaisDejaPrepares: 0,
    seuils: { ecartAchatLive: 0.05, plafondHt: 300, nombreEssais: 10 },
    ...over,
  };
}
const c = (r: ResultatControle[], id: number) => r.find((x) => x.id === id)!;

describe('evaluerControles — cas nominal', () => {
  it('prépare (sans envoi) quand les 8 contrôles passent', () => {
    const s = evaluerControles(entree());
    expect(s.decision).toBe('PREPAREE');
    expect(s.controles.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.controles.every((x) => x.statut === 'OK')).toBe(true);
    expect(s.montantNetHt).toBe(46.8);
    expect(s.numeroEssai).toBe(1);
  });
});

describe('contrôle 1 — dernier relevé du fournisseur', () => {
  it('bloque au-delà de 5 % au-dessus du prix en base', () => {
    const s = evaluerControles(
      entree({ lecture: { ...LIVE, prixNetHt: 24.6 } }), // +5,1 %
    );
    expect(c(s.controles, 1).statut).toBe('BLOQUE');
    expect(c(s.controles, 1).detail).toMatch(/écart 5\.1 % > 5 %/);
    expect(s.decision).toBe('BLOQUEE');
  });
  it('accepte exactement 5 % et tout prix relu plus bas', () => {
    expect(
      c(
        evaluerControles(entree({ lecture: { ...LIVE, prixNetHt: 24.57 } }))
          .controles,
        1,
      ).statut,
    ).toBe('OK');
    expect(
      c(
        evaluerControles(entree({ lecture: { ...LIVE, prixNetHt: 10 } }))
          .controles,
        1,
      ).statut,
    ).toBe('OK');
  });
  it('bloque et oriente vers la rupture si le portail dit indisponible', () => {
    const s = evaluerControles(
      entree({ lecture: { ...LIVE, disponible: false } }),
    );
    expect(c(s.controles, 1).statut).toBe('BLOQUE');
    expect(c(s.controles, 1).detail).toMatch(
      /rupture.*order-rupture-equivalence/,
    );
  });
  it('bloque si la référence du portail ne correspond pas exactement', () => {
    const s = evaluerControles(
      entree({
        lecture: {
          ...LIVE,
          correspondance: 'NON_EXACTE',
          refFournisseur: '602726',
        },
      }),
    );
    expect(c(s.controles, 1).detail).toMatch(/602726/);
    expect(s.decision).toBe('BLOQUEE');
  });
  it('bloque si la lecture est impossible (rien ne part sans relevé frais)', () => {
    const s = evaluerControles(
      entree({
        lecture: {
          ok: false,
          splId: '71',
          motif: 'PORTAIL_EN_ERREUR',
          detail: 'timeout',
          lueA: LIVE.lueA,
        },
      }),
    );
    expect(c(s.controles, 1).detail).toMatch(/PORTAIL_EN_ERREUR/);
    expect(s.decision).toBe('BLOQUEE');
  });
  it('bloque une ligne sans offre vendable avec la procédure de rupture', () => {
    const s = evaluerControles(
      entree({
        proposition: {
          statut: 'RUPTURE',
          offresVendables: 0,
          procedure: '.claude/skills/order-rupture-equivalence/SKILL.md',
        },
        lecture: null,
      }),
    );
    expect(c(s.controles, 1).detail).toMatch(/rupture/);
    expect(s.decision).toBe('BLOQUEE');
  });
});

describe('relevé absent ou de plus de 30 min (complément BK n° 4)', () => {
  // Relevé synthétique : aucune donnée réelle.
  const MAINTENANT = new Date('2026-11-18T10:00:00.000Z');
  const releve = (observedAt: string) => ({
    supplier_id: '71',
    supplier_ref: '500072810',
    public_ht_cents: 6323,
    remise_pct: 63,
    achat_ht_cents: 2340,
    available: true,
    delay_days: null,
    parse_confidence: 'HIGH_CONFIDENCE' as const,
    observed_at: observedAt,
  });

  it.each([
    ['relevé absent', null],
    ['relevé de plus de 30 min', releve('2026-11-18T09:29:59.000Z')],
  ])('%s : contrôles 1, 2 et 6 BLOQUÉS avec ce motif exact', (motif, r) => {
    const s = evaluerControles(
      entree({
        lecture: lectureDepuisReleve(r, '71', '500 0728 10', MAINTENANT),
      }),
    );
    for (const id of [1, 2, 6]) {
      expect(c(s.controles, id).statut).toBe('BLOQUE');
      expect(c(s.controles, id).detail).toBe(motif);
    }
    expect(s.decision).toBe('BLOQUEE');
  });

  it('relevé de 29 min 59 s : utilisé, les contrôles passent', () => {
    const s = evaluerControles(
      entree({
        lecture: lectureDepuisReleve(
          releve('2026-11-18T09:30:01.000Z'),
          '71',
          '500 0728 10',
          MAINTENANT,
        ),
      }),
    );
    expect(s.decision).toBe('PREPAREE');
    expect(c(s.controles, 1).detail).toMatch(
      /net relevé 23\.40 € HT le 2026-11-18T09:30:01/,
    );
  });

  it('la fraîcheur maximale est de 30 min', () => {
    expect(FRAICHEUR_RELEVE_MAX_MINUTES).toBe(30);
  });
});

describe('contrôle 2 — jamais à perte', () => {
  it('bloque si l’achat net live dépasse la vente HT payée', () => {
    // vente 27,00 TTC → 22,50 HT < achat 23,40
    const s = evaluerControles(
      entree({ ligne: { quantite: '2', venteUnitTtc: '27.00', statut: '1' } }),
    );
    expect(c(s.controles, 2).statut).toBe('BLOQUE');
    expect(c(s.controles, 2).detail).toMatch(/vente à perte/);
  });
  it('bloque si la TVA est inconnue', () => {
    const s = evaluerControles(
      entree({ proposition: { ...PROPOSE, tauxTva: null } }),
    );
    expect(c(s.controles, 2).statut).toBe('BLOQUE');
  });
});

describe('contrôle 3 — carte, commande, compatibilité', () => {
  it.each([
    [{ commande: { estPayee: false, statut: '1' } }, /paiement non autorisé/],
    [{ commande: { estPayee: true, statut: '2' } }, /commande annulée/],
    [
      { ligne: { quantite: '2', venteUnitTtc: '54', statut: '3' } },
      /non compatible/,
    ],
    [
      { ligne: { quantite: '2', venteUnitTtc: '54', statut: '4' } },
      /non disponible/,
    ],
    [
      { demande: { compatibiliteVerifiee: false, confirmationPlafond: false } },
      /compatibilité vérifiée/,
    ],
  ] as [Partial<EntreeControles>, RegExp][])('bloque : %#', (over, motif) => {
    const s = evaluerControles(entree(over));
    expect(c(s.controles, 3).statut).toBe('BLOQUE');
    expect(c(s.controles, 3).detail).toMatch(motif);
    expect(s.decision).toBe('BLOQUEE');
  });
});

describe('contrôle 4 — une seule commande (double clic, reprise)', () => {
  it('second clic : DEJA_PREPAREE, jamais une deuxième préparation', () => {
    const s = evaluerControles(entree({ dejaPreparee: true }));
    expect(c(s.controles, 4).statut).toBe('BLOQUE');
    expect(s.decision).toBe('DEJA_PREPAREE');
  });
  it('ligne déjà commandée (statut 6) : bloquée', () => {
    const s = evaluerControles(
      entree({ ligne: { quantite: '2', venteUnitTtc: '54', statut: '6' } }),
    );
    expect(c(s.controles, 4).statut).toBe('BLOQUE');
  });
});

describe('contrôle 5 — quantité de la ligne', () => {
  it('bloque si la proposition porte une autre quantité', () => {
    const s = evaluerControles(
      entree({ proposition: { ...PROPOSE, quantite: 3 } }),
    );
    expect(c(s.controles, 5).statut).toBe('BLOQUE');
  });
  it('bloque une quantité illisible ou fractionnaire', () => {
    for (const q of [null, '0', '1.5', 'x']) {
      const s = evaluerControles(
        entree({ ligne: { quantite: q, venteUnitTtc: '54', statut: '1' } }),
      );
      expect(c(s.controles, 5).statut).toBe('BLOQUE');
    }
  });
});

describe('contrôle 6 — plafond 300 € HT', () => {
  const gros = entree({
    ligne: { quantite: '2', venteUnitTtc: '240', statut: '1' },
    proposition: { ...PROPOSE, prixAchatUnitHt: 160, prixAchatHt: 320 },
    lecture: { ...LIVE, prixNetHt: 160 },
  });
  it('au-dessus : seconde confirmation requise', () => {
    const s = evaluerControles(gros);
    expect(c(s.controles, 6).statut).toBe('A_CONFIRMER');
    expect(s.decision).toBe('CONFIRMATION_REQUISE');
  });
  it('au-dessus avec seconde confirmation : préparée', () => {
    const s = evaluerControles({
      ...gros,
      demande: { compatibiliteVerifiee: true, confirmationPlafond: true },
    });
    expect(c(s.controles, 6).statut).toBe('OK');
    expect(s.decision).toBe('PREPAREE');
  });
  it('un blocage prime sur la demande de confirmation', () => {
    const s = evaluerControles({
      ...gros,
      commande: { estPayee: false, statut: '1' },
    });
    expect(s.decision).toBe('BLOQUEE');
  });
});

describe('contrôles 7 et 8 — trace et mode essai', () => {
  it('7 : la trace est annoncée sur la ligne', () => {
    expect(c(evaluerControles(entree()).controles, 7).detail).toMatch(
      /__admin_audit_log/,
    );
  });
  it('8 : numérote l’essai k/10 et reste non envoyé au-delà', () => {
    expect(
      c(evaluerControles(entree({ essaisDejaPrepares: 9 })).controles, 8)
        .detail,
    ).toMatch(/essai 10\/10 .*non envoyée/);
    const au_dela = evaluerControles(entree({ essaisDejaPrepares: 10 }));
    expect(c(au_dela.controles, 8).detail).toMatch(/toujours non envoyée/);
    expect(au_dela.decision).toBe('PREPAREE');
  });
});
