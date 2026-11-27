/**
 * Équivalents d'une ligne en rupture — mandat CL (décision 50, décisions de
 * Marwane du 18/11/2026).
 *
 * Fonctions pures (aucune base), testées par `rupture-equivalents.test.ts`.
 * La lecture des données est faite par `RuptureEquivalentsService` ; l'écriture
 * (équivalent retenu) par `OrderActionsService`.
 *
 * Un candidat n'est proposé que s'il réunit les quatre preuves, chacune lisible
 * dans la réponse :
 *  1. référence croisée en base (`pieces_ref_search`) : une référence d'origine
 *     constructeur commune (`prs_kind = '3'` des deux côtés), ou la référence
 *     propre du candidat citée par la pièce commandée (`'1'` ↔ `'4'`), ou
 *     l'inverse ;
 *  2. même gamme (`piece_pg_id`), pièce affichée ;
 *  3. même type véhicule que la ligne (`pieces_relation_type`) : le type est
 *     celui de la page d'ajout (`orl_website_url`) ; sans lui, aucune
 *     proposition (jamais de type deviné) ;
 *  4. mêmes critères principaux (`pieces_criteria`, définis par
 *     `pieces_criteria_link` de la gamme, voir `roleCritere`) : dimensions en
 *     mm à `TOLERANCE_DIMENSION_MM` près, autres nombres égaux, valeurs listées
 *     égales ou incluses (« préparé pour indicateur d'usure » ⊂ les deux valeurs
 *     de la pièce commandée). Les critères de type '2' (« Lucas » ⊂ « Lucas /
 *     TRW », numéro WVA…) sont comparés pour information. Un critère présent
 *     d'un seul côté n'est pas comparé, et il est affiché comme tel.
 *
 * L'offre d'achat vient de `proposerFournisseur` (décision 50 : offres
 * vendables, fournisseur de l'annuaire, jamais à perte au tarif ni au prix payé
 * par le client). Le prix payé est conservé ; la marge et le supplément éventuel
 * sont calculés, jamais appliqués ici.
 */
import {
  proposerFournisseur,
  type FournisseurAnnuaire,
  type MotifEcart,
  type OffreTarif,
} from './order-line-supplier-proposal';

/**
 * Écart toléré sur une dimension en mm (largeur, hauteur, épaisseur…).
 *
 * Justification : le catalogue donne les dimensions au dixième de mm, et deux
 * fabricants mesurent la même pièce d'origine constructeur à 0,1 mm près (cas du
 * 16/11 : largeur 131,1 / 131,2 et hauteur 62,1 / 62 pour les mêmes références
 * d'origine). 0,5 mm absorbe cinq pas d'arrondi du catalogue ; un format de
 * pièce différent se distingue par plusieurs mm. Valeur à valider par Marwane :
 * elle ne remplace pas la référence d'origine constructeur commune, exigée en
 * plus.
 */
export const TOLERANCE_DIMENSION_MM = 0.5;

/** Au-delà, la liste est tronquée (et le dit) : l'écran reste lisible. */
export const MAX_EQUIVALENTS_AFFICHES = 10;

// ─── Type véhicule de la ligne ───────────────────────────────────────────────

export interface TypeVehiculeLigne {
  typeId: number;
  /** Alias lisibles de l'URL (« mercedes-benz », « classe-c-w204 », « c-220-cdi »). */
  marque: string;
  modele: string;
  motorisation: string;
}

/** « alias-123 » → { alias, id } ; id absent ou non numérique → null. */
function segment(s: string): { alias: string; id: number } | null {
  const i = s.lastIndexOf('-');
  const id = i > 0 ? s.slice(i + 1) : '';
  if (!/^\d+$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0
    ? { alias: s.slice(0, i), id: n }
    : null;
}

/**
 * Type véhicule lu dans l'URL de la page d'ajout au panier (R2) :
 * `/pieces/<gamme>-<id>/<marque>-<id>/<modele>-<id>/<type>-<id>.html`.
 * Toute autre forme (recherche, page sans véhicule) → null.
 */
export function typeVehiculeDepuisUrl(
  url: string | null | undefined,
): TypeVehiculeLigne | null {
  if (!url) return null;
  let chemin = url.trim();
  try {
    if (/^https?:\/\//i.test(chemin)) chemin = new URL(chemin).pathname;
  } catch {
    return null;
  }
  chemin = chemin.split(/[?#]/)[0];
  const m = /^\/pieces\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.html$/.exec(chemin);
  if (!m) return null;
  const [gamme, marque, modele, type] = [m[1], m[2], m[3], m[4]].map(segment);
  if (!gamme || !marque || !modele || !type) return null;
  return {
    typeId: type.id,
    marque: marque.alias,
    modele: modele.alias,
    motorisation: type.alias,
  };
}

// ─── Référence croisée ───────────────────────────────────────────────────────

/** Ligne de `pieces_ref_search`. */
export interface RefCatalogue {
  /** '1' réf propre, '3' origine constructeur, '4' réf d'une autre marque. */
  kind: string;
  /** `prs_search` (normalisée). */
  search: string;
  /** `prs_ref` (affichée). */
  ref: string | null;
}

export interface PreuveReference {
  /** Références d'origine constructeur communes (affichage de la pièce commandée). */
  oemCommunes: string[];
  /** La pièce commandée cite la référence propre du candidat. */
  citeeParCommandee: boolean;
  /** Le candidat cite la référence propre de la pièce commandée. */
  citeCommandee: boolean;
}

export function preuveReference(
  commandee: RefCatalogue[],
  candidat: RefCatalogue[],
): PreuveReference | null {
  const de = (refs: RefCatalogue[], kind: string) =>
    new Set(refs.filter((r) => r.kind === kind).map((r) => r.search));
  const oemCandidat = de(candidat, '3');
  const oemCommunes = [
    ...new Set(
      commandee
        .filter((r) => r.kind === '3' && oemCandidat.has(r.search))
        .map((r) => r.ref ?? r.search),
    ),
  ].sort();
  const citesParCommandee = de(commandee, '4');
  const citesParCandidat = de(candidat, '4');
  const citeeParCommandee = [...de(candidat, '1')].some((s) =>
    citesParCommandee.has(s),
  );
  const citeCommandee = [...de(commandee, '1')].some((s) =>
    citesParCandidat.has(s),
  );
  if (oemCommunes.length === 0 && !citeeParCommandee && !citeCommandee) {
    return null;
  }
  return { oemCommunes, citeeParCommandee, citeCommandee };
}

/** Recherches à interroger pour trouver les candidats (une seule requête). */
export function recherchesCandidats(commandee: RefCatalogue[]): string[] {
  return [
    ...new Set(
      commandee
        .filter((r) => ['1', '3', '4'].includes(r.kind) && r.search)
        .map((r) => r.search),
    ),
  ].sort();
}

// ─── Critères ────────────────────────────────────────────────────────────────

/** Ligne de `pieces_criteria`. */
export interface CritereLu {
  criId: string;
  valeur: string;
}

/** Ligne de `pieces_criteria_link` de la gamme. */
export interface DefinitionCritere {
  criId: string;
  libelle: string;
  unite: string | null;
  /** `pcl_cri_type` : '1' nombre, '2' référence, '3' valeur listée, '5' indicateur. */
  type: string | null;
}

export type VerdictCritere = 'IDENTIQUE' | 'PROCHE' | 'DIFFERENT';

export interface CritereCompare {
  criId: string;
  libelle: string;
  unite: string | null;
  commandee: string[];
  equivalent: string[];
  verdict: VerdictCritere;
  /** Un écart sur ce critère écarte le candidat (sinon : à vérifier). */
  bloquant: boolean;
  /** Écart maximal en mm (dimension) ; null sinon. */
  ecartMm: number | null;
}

export interface CritereNonCompare {
  criId: string;
  libelle: string;
  /** Côté(s) où le critère est renseigné. */
  renseigne: 'COMMANDEE' | 'EQUIVALENT' | 'LES_DEUX';
  /**
   * UN_SEUL_COTE : critère principal absent d'une des deux fiches ;
   * NON_PRINCIPAL : indicateur, poids, cote de conditionnement, ou critère
   * sans définition dans la gamme.
   */
  motif: 'UN_SEUL_COTE' | 'NON_PRINCIPAL';
}

export interface ComparaisonCriteres {
  compares: CritereCompare[];
  nonCompares: CritereNonCompare[];
  /** ≥ 1 critère bloquant comparé et aucun critère bloquant DIFFERENT. */
  compatible: boolean;
  /** Somme des écarts en mm (classement). */
  ecartTotalMm: number;
  /** Critères informatifs différents : à vérifier par Marwane (classement). */
  aVerifier: number;
}

/** Unités de poids et de conditionnement (cotes du colis en cm, gamme 402). */
const UNITES_NON_COMPAREES = new Set(['kg', 'g', 't', 'cm']);

/**
 * Rôle d'un critère dans la preuve :
 *  - BLOQUANT : nombre (`pcl_cri_type` '1') hors poids et conditionnement, ou
 *    valeur listée ('3') ; un écart écarte le candidat ;
 *  - INFORMATIF : type '2' (système, numéro WVA, marque de conformité, référence
 *    d'accessoire) ; comparé et affiché quand les deux fiches le portent, jamais
 *    bloquant, car il mêle des identifiants propres à chaque fabricant ;
 *  - null : indicateur ('5'), poids, conditionnement, critère sans définition.
 */
export function roleCritere(
  def: DefinitionCritere | undefined,
): 'BLOQUANT' | 'INFORMATIF' | null {
  if (!def) return null;
  const unite = (def.unite ?? '').trim().toLowerCase();
  if (def.type === '1')
    return UNITES_NON_COMPAREES.has(unite) ? null : 'BLOQUANT';
  if (def.type === '3') return 'BLOQUANT';
  if (def.type === '2') return 'INFORMATIF';
  return null;
}

const nombre = (v: string): number | null => {
  const t = v.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

const jetons = (valeurs: string[]): Set<string> =>
  new Set(
    valeurs
      .flatMap((v) => v.split('/'))
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );

function comparerValeurs(
  def: DefinitionCritere,
  a: string[],
  b: string[],
): { verdict: VerdictCritere; ecartMm: number | null } {
  const unite = (def.unite ?? '').trim().toLowerCase();
  if (def.type === '1') {
    const na = a.map(nombre).sort((x, y) => (x ?? 0) - (y ?? 0));
    const nb = b.map(nombre).sort((x, y) => (x ?? 0) - (y ?? 0));
    if (
      na.length !== nb.length ||
      na.some((x) => x == null) ||
      nb.some((x) => x == null)
    ) {
      return { verdict: 'DIFFERENT', ecartMm: null };
    }
    const ecart = Math.max(
      ...na.map((x, i) => Math.abs((x as number) - (nb[i] as number))),
    );
    const arrondi = Math.round(ecart * 1000) / 1000;
    if (arrondi === 0) {
      return { verdict: 'IDENTIQUE', ecartMm: unite === 'mm' ? 0 : null };
    }
    if (unite === 'mm' && arrondi <= TOLERANCE_DIMENSION_MM) {
      return { verdict: 'PROCHE', ecartMm: arrondi };
    }
    return { verdict: 'DIFFERENT', ecartMm: unite === 'mm' ? arrondi : null };
  }
  const ja = jetons(a);
  const jb = jetons(b);
  const egal = ja.size === jb.size && [...ja].every((x) => jb.has(x));
  if (egal) return { verdict: 'IDENTIQUE', ecartMm: null };
  const inclus =
    [...ja].every((x) => jb.has(x)) || [...jb].every((x) => ja.has(x));
  return { verdict: inclus ? 'PROCHE' : 'DIFFERENT', ecartMm: null };
}

export function comparerCriteres(
  commandee: CritereLu[],
  equivalent: CritereLu[],
  definitions: Map<string, DefinitionCritere>,
): ComparaisonCriteres {
  const grouper = (lus: CritereLu[]) => {
    const m = new Map<string, string[]>();
    for (const c of lus) m.set(c.criId, [...(m.get(c.criId) ?? []), c.valeur]);
    return m;
  };
  const a = grouper(commandee);
  const b = grouper(equivalent);
  const compares: CritereCompare[] = [];
  const nonCompares: CritereNonCompare[] = [];
  const ids = [...new Set([...a.keys(), ...b.keys()])].sort(
    (x, y) => Number(x) - Number(y) || x.localeCompare(y),
  );
  for (const criId of ids) {
    const def = definitions.get(criId);
    const va = a.get(criId);
    const vb = b.get(criId);
    const libelle = def?.libelle ?? `Critère ${criId}`;
    const renseigne = va && vb ? 'LES_DEUX' : va ? 'COMMANDEE' : 'EQUIVALENT';
    const role = roleCritere(def);
    if (!def || !role) {
      nonCompares.push({ criId, libelle, renseigne, motif: 'NON_PRINCIPAL' });
      continue;
    }
    if (!va || !vb) {
      nonCompares.push({ criId, libelle, renseigne, motif: 'UN_SEUL_COTE' });
      continue;
    }
    compares.push({
      criId,
      libelle,
      unite: def.unite,
      commandee: va,
      equivalent: vb,
      bloquant: role === 'BLOQUANT',
      ...comparerValeurs(def, va, vb),
    });
  }
  return {
    compares,
    nonCompares,
    compatible:
      compares.some((c) => c.bloquant) &&
      compares.every((c) => !c.bloquant || c.verdict !== 'DIFFERENT'),
    aVerifier: compares.filter((c) => !c.bloquant && c.verdict === 'DIFFERENT')
      .length,
    ecartTotalMm:
      Math.round(compares.reduce((s, c) => s + (c.ecartMm ?? 0), 0) * 1000) /
      1000,
  };
}

// ─── Classement ──────────────────────────────────────────────────────────────

/** Offre de tarif telle que lue (`SellablePriceRow`), réduite au nécessaire. */
export interface OffreEquivalent extends OffreTarif {
  /** `pri_vente_ttc_n` — prix du site, à l'unité. */
  venteTtc: number | string | null;
  /** `pri_consigne_ttc_n` */
  consigneTtc: number | string | null;
  /** `pri_date_from` — date du tarif ; null si inconnue. */
  dateTarif: string | null;
}

export interface PieceCandidate {
  pieceId: number;
  ref: string | null;
  marque: string | null;
  gammeId: number | null;
  affichee: boolean;
  refs: RefCatalogue[];
  criteres: CritereLu[];
  /** Le candidat est relié au type véhicule de la ligne. */
  couvreTypeLigne: boolean;
  offres: OffreEquivalent[];
}

export interface PieceCommandee {
  pieceId: number;
  gammeId: number | null;
  refs: RefCatalogue[];
  criteres: CritereLu[];
}

export interface LigneRupture {
  /** `orl_art_quantity` */
  quantite: number | string | null;
  /** `orl_art_price_sell_unit_ttc` — prix unitaire payé. */
  venteUnitTtc: number | string | null;
  /** `orl_art_price_sell_ttc` + `orl_art_deposit_ttc` — total payé pour la ligne. */
  totalPayeTtc: number | string | null;
}

export type StatutEquivalent =
  /** Retenable en un clic : la ligne garde le prix payé, sans perte. */
  | 'RETENABLE'
  /** À perte au prix payé : supplément obligatoire (formulaire « Supplément après rupture »). */
  | 'SUPPLEMENT_REQUIS';

export interface Equivalent {
  pieceId: number;
  marque: string | null;
  ref: string | null;
  statut: StatutEquivalent;
  preuve: {
    reference: PreuveReference;
    typeVehicule: number;
    criteres: ComparaisonCriteres;
  };
  achat: {
    splId: string;
    fournisseur: string;
    libelleFournisseur: string;
    prixAchatUnitHt: number;
    prixAchatHt: number;
    quantite: number;
    /** Taux de TVA de l'offre (`pri_tva_n`) ; null si inconnu. */
    tauxTva: number | null;
    /** Origine du prix : le tarif en base et sa date (relevé fournisseur : #2166). */
    origine: { type: 'TARIF'; dateTarif: string | null };
  };
  /** Marge si la ligne garde le prix payé ; null si la TVA est inconnue. */
  margeAuPrixPaye: { unitHt: number; totalHt: number; taux: number } | null;
  /** Prix du site de l'équivalent × quantité − total payé, s'il est positif. */
  supplementTtc: number;
  venteSiteUnitTtc: number | null;
}

export type MotifCandidatEcarte =
  | 'GAMME_DIFFERENTE'
  | 'NON_AFFICHEE'
  | 'TYPE_VEHICULE_NON_COUVERT'
  | 'CRITERES_DIFFERENTS'
  | 'CRITERES_NON_COMPARABLES'
  | 'INDISPONIBLE'
  | 'CONSIGNE'
  | 'OFFRE_INCOMPLETE';

export interface ResultatEquivalents {
  equivalents: Equivalent[];
  /** Nombre d'équivalents au-delà de `MAX_EQUIVALENTS_AFFICHES`. */
  tronques: number;
  /** Candidats à référence croisée écartés, par motif (observabilité). */
  ecartes: Partial<Record<MotifCandidatEcarte, number>>;
  /** Motifs d'achat écartés pour les candidats OFFRE_INCOMPLETE. */
  motifsAchat: Partial<Record<MotifEcart, number>>;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const centimes = (v: number): number => Math.round(v * 100) / 100;

/** Plus la preuve de référence est directe, plus le candidat remonte. */
function forcePreuve(p: PreuveReference): number {
  return (
    (p.citeeParCommandee ? 2 : 0) +
    (p.citeCommandee ? 2 : 0) +
    Math.min(p.oemCommunes.length, 5)
  );
}

export function classerEquivalents(
  commandee: PieceCommandee,
  typeLigne: TypeVehiculeLigne,
  ligne: LigneRupture,
  candidats: PieceCandidate[],
  definitions: Map<string, DefinitionCritere>,
  annuaire: Map<string, FournisseurAnnuaire>,
): ResultatEquivalents {
  const ecartes: ResultatEquivalents['ecartes'] = {};
  const motifsAchat: ResultatEquivalents['motifsAchat'] = {};
  const ecarter = (m: MotifCandidatEcarte) => {
    ecartes[m] = (ecartes[m] ?? 0) + 1;
  };
  const totalPaye = num(ligne.totalPayeTtc);
  const venteUnitPayee = num(ligne.venteUnitTtc);
  const retenus: { e: Equivalent; force: number }[] = [];

  for (const c of candidats) {
    if (c.pieceId === commandee.pieceId) continue;
    const reference = preuveReference(commandee.refs, c.refs);
    if (!reference) continue; // pas un candidat : aucune référence croisée
    if (commandee.gammeId == null || c.gammeId !== commandee.gammeId) {
      ecarter('GAMME_DIFFERENTE');
      continue;
    }
    if (!c.affichee) {
      ecarter('NON_AFFICHEE');
      continue;
    }
    if (!c.couvreTypeLigne) {
      ecarter('TYPE_VEHICULE_NON_COUVERT');
      continue;
    }
    const criteres = comparerCriteres(
      commandee.criteres,
      c.criteres,
      definitions,
    );
    if (!criteres.compatible) {
      ecarter(
        !criteres.compares.some((x) => x.bloquant)
          ? 'CRITERES_NON_COMPARABLES'
          : 'CRITERES_DIFFERENTS',
      );
      continue;
    }

    // Achat : offre vendable au prix payé (décision 50), sinon au seul tarif.
    let statut: StatutEquivalent = 'RETENABLE';
    let prop = proposerFournisseur(c.offres, annuaire, {
      quantite: ligne.quantite,
      venteUnitTtc: ligne.venteUnitTtc,
    });
    if (prop.statut === 'RUPTURE') {
      ecarter('INDISPONIBLE');
      continue;
    }
    if (
      prop.statut === 'A_COMPLETER' &&
      !prop.motifLigne &&
      prop.offresEcartees.some((o) => o.motif === 'VENTE_A_PERTE_LIGNE')
    ) {
      const auTarif = proposerFournisseur(c.offres, annuaire, {
        quantite: ligne.quantite,
        venteUnitTtc: null,
      });
      if (auTarif.statut === 'PROPOSE') {
        prop = auTarif;
        statut = 'SUPPLEMENT_REQUIS';
      }
    }
    if (prop.statut !== 'PROPOSE') {
      ecarter('OFFRE_INCOMPLETE');
      if (prop.statut === 'A_COMPLETER') {
        for (const o of prop.offresEcartees) {
          motifsAchat[o.motif] = (motifsAchat[o.motif] ?? 0) + 1;
        }
      }
      continue;
    }
    const retenue = prop;
    const offre = c.offres.find(
      (o) =>
        o.libelleFournisseur === retenue.libelleFournisseur &&
        num(o.achatHt) != null &&
        centimes(num(o.achatHt) as number) === retenue.prixAchatUnitHt,
    );
    if ((num(offre?.consigneTtc) ?? 0) > 0) {
      // Équivalent à consigne : hors procédure (skill §6), Marwane décide.
      ecarter('CONSIGNE');
      continue;
    }
    const venteSite = num(offre?.venteTtc);
    const supplement =
      venteSite != null && totalPaye != null
        ? Math.max(0, centimes(venteSite * retenue.quantite - totalPaye))
        : 0;
    const tva = retenue.tauxTva;
    let marge: Equivalent['margeAuPrixPaye'] = null;
    if (venteUnitPayee != null && tva != null) {
      const payeHt = venteUnitPayee / (1 + tva);
      const unit = payeHt - retenue.prixAchatUnitHt;
      marge = {
        unitHt: centimes(unit),
        totalHt: centimes(unit * retenue.quantite),
        taux: payeHt > 0 ? Math.round((unit / payeHt) * 1000) / 1000 : 0,
      };
    }
    if (statut === 'RETENABLE' && (marge == null || marge.unitHt < 0)) {
      statut = 'SUPPLEMENT_REQUIS';
    }

    retenus.push({
      force: forcePreuve(reference),
      e: {
        pieceId: c.pieceId,
        marque: c.marque,
        ref: c.ref,
        statut,
        preuve: { reference, typeVehicule: typeLigne.typeId, criteres },
        achat: {
          splId: retenue.splId,
          fournisseur: retenue.nomFournisseur,
          libelleFournisseur: retenue.libelleFournisseur,
          prixAchatUnitHt: retenue.prixAchatUnitHt,
          prixAchatHt: retenue.prixAchatHt,
          quantite: retenue.quantite,
          tauxTva: retenue.tauxTva,
          origine: { type: 'TARIF', dateTarif: offre?.dateTarif ?? null },
        },
        margeAuPrixPaye: marge,
        supplementTtc: supplement,
        venteSiteUnitTtc: venteSite,
      },
    });
  }

  retenus.sort(
    (x, y) =>
      Number(x.e.statut !== 'RETENABLE') - Number(y.e.statut !== 'RETENABLE') ||
      y.force - x.force ||
      x.e.preuve.criteres.aVerifier - y.e.preuve.criteres.aVerifier ||
      x.e.preuve.criteres.ecartTotalMm - y.e.preuve.criteres.ecartTotalMm ||
      x.e.achat.prixAchatUnitHt - y.e.achat.prixAchatUnitHt ||
      x.e.pieceId - y.e.pieceId,
  );
  return {
    equivalents: retenus.slice(0, MAX_EQUIVALENTS_AFFICHES).map((r) => r.e),
    tronques: Math.max(0, retenus.length - MAX_EQUIVALENTS_AFFICHES),
    ecartes,
    motifsAchat,
  };
}

// ─── Texte du mail à copier ──────────────────────────────────────────────────

export interface ContexteTexteMail {
  orderId: string;
  /** Pièce commandée, telle que la ligne la nomme. */
  marqueCommandee: string | null;
  refCommandee: string | null;
  quantite: number;
  equivalent: Equivalent;
  type: TypeVehiculeLigne;
}

const alias = (s: string) => s.replace(/-/g, ' ').toUpperCase();
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/**
 * Texte du mail « rupture avec équivalent et demande d'immatriculation ou de
 * référence » (décision de Marwane du 18/11/2026), à copier. Il ne part jamais
 * d'ici : Marwane le relit, le corrige et l'envoie (règle cardinale du skill).
 * Quand le mandat CG (#2173) sera fusionné, ce texte rejoindra ses modèles.
 */
export function texteMailEquivalent(ctx: ContexteTexteMail): {
  objet: string;
  corps: string;
} {
  const e = ctx.equivalent;
  const commandee = [ctx.marqueCommandee, ctx.refCommandee]
    .filter(Boolean)
    .join(' ');
  const propose = [e.marque, e.ref].filter(Boolean).join(' ');
  const criteres = e.preuve.criteres.compares
    .filter((c) => c.bloquant)
    .map((c) => {
      const v = (xs: string[]) => xs.join(' / ');
      const unite = c.unite ? ` ${c.unite}` : '';
      return c.verdict === 'IDENTIQUE'
        ? `- ${c.libelle} : ${v(c.equivalent)}${unite}`
        : `- ${c.libelle} : ${v(c.equivalent)}${unite} (pièce commandée : ${v(c.commandee)}${unite})`;
    })
    .join('\n');
  const oem = e.preuve.reference.oemCommunes.slice(0, 4).join(', ');
  const vehicule = [ctx.type.marque, ctx.type.modele, ctx.type.motorisation]
    .map(alias)
    .join(' ');
  const prix =
    e.supplementTtc > 0
      ? `LE PRIX\nCet équivalent coûte ${euros(e.supplementTtc)} de plus que la pièce commandée. [À COMPLÉTER : supplément demandé ou offert, décision de Marwane]`
      : 'LE PRIX\nLe prix reste celui que vous avez payé : aucun supplément, aucun remboursement à prévoir.';
  const corps = [
    'Bonjour,',
    `Merci pour votre commande ${ctx.orderId} : ${ctx.quantite} × ${commandee}.`,
    'Notre fournisseur est en rupture de stock sur cette pièce, sans date de retour. Plutôt que de vous faire attendre, nous avons trouvé un équivalent disponible tout de suite.',
    `NOTRE PROPOSITION\n${propose}${oem ? `, mêmes références d'origine constructeur (${oem})` : ''}, mêmes caractéristiques :\n${criteres}`,
    `VOTRE VÉHICULE\nCette pièce est référencée pour le véhicule de votre commande (${vehicule}). Pour une vérification complète avant l'envoi, merci de nous indiquer en réponse à ce mail l'immatriculation du véhicule ou la référence d'origine constructeur de la pièce montée.`,
    prix,
    "POUR ACCEPTER\nRépondez simplement à ce mail avec l'immatriculation ou la référence : nous vérifions la compatibilité et nous expédions aussitôt.",
    'Si cette proposition ne vous convient pas, répondez à ce mail : nous annulons la commande et vous remboursons intégralement.',
    "Cordialement,\nL'équipe AutoMecanik",
  ].join('\n\n');
  return {
    objet: `Votre commande ${ctx.orderId} : une solution disponible tout de suite`,
    corps,
  };
}
