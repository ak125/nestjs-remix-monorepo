/**
 * Proposition du fournisseur d'une ligne de commande — décision 50 de l'owner
 * (2026-11-15/16) : proposer automatiquement la pièce disponible au meilleur
 * prix d'achat, confirmée ensuite en un geste dans l'administration.
 *
 * Fonction pure (aucune base), testée par `order-line-supplier-proposal.test.ts`.
 *
 * Entrées : les offres VENDABLES de la pièce (définition unique, décision 51,
 * `PiecePriceDataService.findSellableOffers`), l'annuaire fournisseurs
 * (`___xtr_supplier`, lu par le module supplier-truth) et la ligne commandée.
 *
 * Règles :
 *  - aucune offre vendable → RUPTURE (marquage et procédure
 *    `.claude/skills/order-rupture-equivalence/SKILL.md`) ;
 *  - une offre n'est retenue que si son prix d'achat HT est strictement
 *    positif, son libellé fournisseur (`pri_frs`) est connu de l'annuaire, et si
 *    elle ne fait vendre à perte ni au tarif (vente HT ≥ achat HT) ni au prix
 *    payé par le client (prix unitaire TTC de la ligne / (1 + TVA) ≥ achat HT) ;
 *  - parmi les offres retenues : plus petit prix d'achat, puis libellé (ordre
 *    stable, aucune préférence fournisseur inventée) ;
 *  - offres vendables mais aucune retenue → A_COMPLETER, avec le motif de
 *    chaque offre écartée (jamais de fournisseur ni de prix inventé) ;
 *  - quantité de la ligne illisible, nulle ou fractionnaire → A_COMPLETER
 *    (`motifLigne`), jamais de quantité devinée.
 */

export interface OffreTarif {
  /** `pri_frs` */
  libelleFournisseur: string | null;
  /** `pri_achat_ht_n` */
  achatHt: number | string | null;
  /** `pri_vente_ht_n` */
  venteHt: number | string | null;
  /** `pri_tva_n` — taux (0.2 = 20 %). */
  tauxTva: number | string | null;
  /** `pri_type` */
  type: string;
}

export interface FournisseurAnnuaire {
  splId: string;
  nom: string;
}

export interface LigneCommandee {
  /** `orl_art_quantity` */
  quantite: number | string | null;
  /** `orl_art_price_sell_unit_ttc` — prix payé par le client. */
  venteUnitTtc: number | string | null;
}

export type MotifEcart =
  | 'PRIX_ACHAT_ABSENT'
  | 'FOURNISSEUR_INCONNU'
  | 'VENTE_A_PERTE_TARIF'
  | 'VENTE_A_PERTE_LIGNE'
  | 'TVA_INCONNUE';

export interface OffreEcartee {
  libelleFournisseur: string | null;
  type: string;
  motif: MotifEcart;
}

export type PropositionFournisseur =
  | {
      statut: 'PROPOSE';
      splId: string;
      nomFournisseur: string;
      libelleFournisseur: string;
      prixAchatUnitHt: number;
      quantite: number;
      prixAchatHt: number;
      /** Taux de TVA de l'offre retenue (`pri_tva_n`) ; null si inconnu. */
      tauxTva: number | null;
      offresVendables: number;
      offresEcartees: OffreEcartee[];
    }
  | {
      statut: 'RUPTURE';
      offresVendables: 0;
      procedure: string;
    }
  | {
      statut: 'A_COMPLETER';
      offresVendables: number;
      offresEcartees: OffreEcartee[];
      /** Défaut de la ligne elle-même (et non d'une offre). */
      motifLigne?: 'QUANTITE_ILLISIBLE';
    };

export const PROCEDURE_RUPTURE =
  '.claude/skills/order-rupture-equivalence/SKILL.md';

const nombre = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Montant arrondi au centime (les colonnes de la ligne sont en euros). */
const centimes = (v: number): number => Math.round(v * 100) / 100;

/** Clé d'annuaire : libellé en majuscules, sans espaces de bord. */
export const cleFournisseur = (libelle: string): string =>
  libelle.trim().toUpperCase();

export function proposerFournisseur(
  offres: OffreTarif[],
  annuaire: Map<string, FournisseurAnnuaire>,
  ligne: LigneCommandee,
): PropositionFournisseur {
  if (offres.length === 0) {
    return {
      statut: 'RUPTURE',
      offresVendables: 0,
      procedure: PROCEDURE_RUPTURE,
    };
  }
  const quantite = nombre(ligne.quantite);
  if (quantite == null || !Number.isInteger(quantite) || quantite <= 0) {
    // Jamais de quantité devinée : le total d'achat en dépend.
    return {
      statut: 'A_COMPLETER',
      offresVendables: offres.length,
      offresEcartees: [],
      motifLigne: 'QUANTITE_ILLISIBLE',
    };
  }
  const venteUnitTtc = nombre(ligne.venteUnitTtc);

  const ecartees: OffreEcartee[] = [];
  const retenues: {
    four: FournisseurAnnuaire;
    libelle: string;
    achat: number;
    tva: number | null;
  }[] = [];
  for (const o of offres) {
    const ecarter = (motif: MotifEcart) =>
      ecartees.push({
        libelleFournisseur: o.libelleFournisseur,
        type: o.type,
        motif,
      });
    const achat = nombre(o.achatHt);
    if (achat == null || achat <= 0) {
      ecarter('PRIX_ACHAT_ABSENT');
      continue;
    }
    const four = o.libelleFournisseur
      ? annuaire.get(cleFournisseur(o.libelleFournisseur))
      : undefined;
    if (!four || !o.libelleFournisseur) {
      ecarter('FOURNISSEUR_INCONNU');
      continue;
    }
    const venteHt = nombre(o.venteHt);
    if (venteHt == null || venteHt < achat) {
      ecarter('VENTE_A_PERTE_TARIF');
      continue;
    }
    if (venteUnitTtc != null) {
      const tva = nombre(o.tauxTva);
      if (tva == null || tva < 0) {
        ecarter('TVA_INCONNUE');
        continue;
      }
      if (venteUnitTtc / (1 + tva) < achat) {
        ecarter('VENTE_A_PERTE_LIGNE');
        continue;
      }
    }
    const tva = nombre(o.tauxTva);
    retenues.push({
      four,
      libelle: o.libelleFournisseur,
      achat,
      tva: tva != null && tva >= 0 ? tva : null,
    });
  }

  if (retenues.length === 0) {
    return {
      statut: 'A_COMPLETER',
      offresVendables: offres.length,
      offresEcartees: ecartees,
    };
  }
  retenues.sort(
    (a, b) => a.achat - b.achat || a.libelle.localeCompare(b.libelle),
  );
  const choix = retenues[0];
  return {
    statut: 'PROPOSE',
    splId: choix.four.splId,
    nomFournisseur: choix.four.nom,
    libelleFournisseur: choix.libelle,
    prixAchatUnitHt: centimes(choix.achat),
    quantite,
    prixAchatHt: centimes(choix.achat * quantite),
    tauxTva: choix.tva,
    offresVendables: offres.length,
    offresEcartees: ecartees,
  };
}
