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
 *
 * Complément BK n° 4 (18/11/2026) : un relevé fournisseur FRAIS
 * (`supplier_offer_snapshot`, ≤ 30 min, écrit par DEV) prime sur le tarif. Parmi
 * les relevés frais, disponibles, à correspondance exacte, de prix d'achat > 0,
 * d'un fournisseur de l'annuaire et qui ne font pas vendre à perte au prix payé
 * par le client (TVA du tarif de la pièce, unique) : le moins cher, puis l'id
 * fournisseur. Sans relevé retenu, la proposition vient du tarif et porte la
 * date de ce tarif (`origine.dateTarif`) : jamais présentée comme actuelle.
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
  /** `pri_date_from` — date du tarif ; null si inconnue. */
  dateTarif?: string | null;
}

/** Relevé fournisseur d'une pièce, fraîcheur déjà évaluée par l'appelant. */
export interface ReleveCandidat {
  splId: string;
  /** Prix d'achat net HT relevé (euros) ; null si non lu. */
  achatHt: number | null;
  disponible: boolean;
  /** Correspondance exacte de la référence sur le portail. */
  exacte: boolean;
  /** Relevé ≤ `FRAICHEUR_RELEVE_MAX_MINUTES`. */
  frais: boolean;
  observeA: string;
}

/** D'où vient le prix d'achat proposé. */
type OrigineProposition =
  | { type: 'RELEVE'; observeA: string }
  | { type: 'TARIF'; dateTarif: string | null };

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
      origine: OrigineProposition;
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

/** Taux de TVA du tarif de la pièce s'il est unique parmi les offres ; sinon null. */
function tvaUnique(offres: OffreTarif[]): number | null {
  const taux = new Set<number>();
  for (const o of offres) {
    const t = nombre(o.tauxTva);
    if (t != null && t >= 0) taux.add(t);
  }
  return taux.size === 1 ? [...taux][0] : null;
}

/** Meilleur relevé frais retenu (voir l'en-tête) ; null si aucun. */
function meilleurReleve(
  releves: ReleveCandidat[],
  annuaire: Map<string, FournisseurAnnuaire>,
  offres: OffreTarif[],
  venteUnitTtc: number | null,
): {
  four: FournisseurAnnuaire;
  achat: number;
  tva: number;
  observeA: string;
} | null {
  const tva = tvaUnique(offres);
  if (tva == null || venteUnitTtc == null || venteUnitTtc <= 0) return null;
  const venteHt = venteUnitTtc / (1 + tva);
  const parId = new Map<string, FournisseurAnnuaire>();
  for (const f of annuaire.values()) parId.set(f.splId, f);
  const retenus = releves
    .filter(
      (r) =>
        r.frais &&
        r.disponible &&
        r.exacte &&
        r.achatHt != null &&
        r.achatHt > 0 &&
        r.achatHt <= venteHt &&
        parId.has(r.splId),
    )
    .sort(
      (a, b) =>
        (a.achatHt as number) - (b.achatHt as number) ||
        a.splId.localeCompare(b.splId),
    );
  const r = retenus[0];
  return r
    ? {
        four: parId.get(r.splId) as FournisseurAnnuaire,
        achat: r.achatHt as number,
        tva,
        observeA: r.observeA,
      }
    : null;
}

export function proposerFournisseur(
  offres: OffreTarif[],
  annuaire: Map<string, FournisseurAnnuaire>,
  ligne: LigneCommandee,
  releves: ReleveCandidat[] = [],
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

  const releve = meilleurReleve(releves, annuaire, offres, venteUnitTtc);
  if (releve) {
    return {
      statut: 'PROPOSE',
      splId: releve.four.splId,
      nomFournisseur: releve.four.nom,
      libelleFournisseur: releve.four.nom,
      prixAchatUnitHt: centimes(releve.achat),
      quantite,
      prixAchatHt: centimes(releve.achat * quantite),
      tauxTva: releve.tva,
      offresVendables: offres.length,
      offresEcartees: [],
      origine: { type: 'RELEVE', observeA: releve.observeA },
    };
  }

  const ecartees: OffreEcartee[] = [];
  const retenues: {
    four: FournisseurAnnuaire;
    libelle: string;
    achat: number;
    tva: number | null;
    dateTarif: string | null;
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
      dateTarif: o.dateTarif ?? null,
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
    origine: { type: 'TARIF', dateTarif: choix.dateTarif },
  };
}
