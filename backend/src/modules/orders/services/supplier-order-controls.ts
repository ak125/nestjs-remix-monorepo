/**
 * Les 8 contrôles d'une commande fournisseur préparée (mandat BK, décision de
 * Marwane du 17/11/2026 à 18:04). Fonctions pures : aucune lecture, aucune
 * écriture, aucun appel réseau. Le service de préparation fournit les faits
 * (commande, ligne, proposition, relecture live) et applique la décision.
 *
 * Aucun contrôle ne déclenche d'envoi : la décision la plus favorable est
 * `PREPAREE`, c'est-à-dire une commande préparée, tracée et NON envoyée.
 */
import { OrderLineStatus, OrderStatus } from '@repo/domain-commerce';
import type { ResultatLecture } from '../../supplier-truth';
import {
  PROCEDURE_RUPTURE,
  type PropositionFournisseur,
} from './order-line-supplier-proposal';

export type StatutControle = 'OK' | 'BLOQUE' | 'A_CONFIRMER';

export type CodeControle =
  | 'RELECTURE_LIVE'
  | 'JAMAIS_A_PERTE'
  | 'CARTE_COMMANDE_COMPATIBILITE'
  | 'UNE_SEULE_COMMANDE'
  | 'QUANTITE_DE_LA_LIGNE'
  | 'PLAFOND_HT'
  | 'TRACE'
  | 'MODE_ESSAI';

export interface ResultatControle {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  code: CodeControle;
  statut: StatutControle;
  detail: string;
}

export type DecisionPreparation =
  | 'PREPAREE'
  | 'BLOQUEE'
  | 'CONFIRMATION_REQUISE'
  | 'DEJA_PREPAREE';

export interface Seuils {
  /** 0.05 = 5 % */
  ecartAchatLive: number;
  plafondHt: number;
  nombreEssais: number;
}

export interface EntreeControles {
  commande: {
    /** `ord_is_pay === '1'` (paiement autorisé). */
    estPayee: boolean;
    /** `ord_ords_id` ; '2' = annulée (`OrderStatus.CANCELLED`). */
    statut: string | null;
  };
  ligne: {
    quantite: number | string | null;
    venteUnitTtc: number | string | null;
    /** `orl_orls_id` */
    statut: string | null;
  };
  proposition: PropositionFournisseur;
  /** Relecture live du fournisseur proposé ; null si aucune proposition. */
  lecture: ResultatLecture | null;
  demande: {
    compatibiliteVerifiee: boolean;
    confirmationPlafond: boolean;
  };
  /** Une préparation existe déjà pour cette ligne (double clic, reprise). */
  dejaPreparee: boolean;
  /** Préparations déjà enregistrées, toutes lignes confondues. */
  essaisDejaPrepares: number;
  seuils: Seuils;
}

export interface SortieControles {
  decision: DecisionPreparation;
  controles: ResultatControle[];
  /** Montant net HT de la commande préparée (prix net live × quantité). */
  montantNetHt: number | null;
  /** Numéro d'essai attribué si la préparation aboutit. */
  numeroEssai: number;
}

/**
 * Statuts de ligne (`@repo/domain-commerce`) qui interdisent la commande :
 * annulée, non compatible, non disponible (rupture marquée), équivalence refusée.
 */
const LIGNE_INTERDITE: Record<string, string> = {
  [OrderLineStatus.CANCELLED]: 'annulée',
  [OrderLineStatus.NOT_COMPATIBLE]: 'non compatible',
  [OrderLineStatus.NOT_AVAILABLE]: 'non disponible (rupture)',
  [OrderLineStatus.EQUIV_REFUSED]: 'équivalence refusée',
};
const LIGNE_COMMANDEE: string = OrderLineStatus.ORDERED_FROM_SUPPLIER;
const COMMANDE_ANNULEE: string = OrderStatus.CANCELLED;

const nombre = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const centimes = (v: number): number => Math.round(v * 100) / 100;
const eur = (v: number): string => `${v.toFixed(2)} € HT`;

export function evaluerControles(e: EntreeControles): SortieControles {
  const p = e.proposition.statut === 'PROPOSE' ? e.proposition : null;
  const live = e.lecture?.ok ? e.lecture : null;
  const quantite = nombre(e.ligne.quantite);
  const net = live?.prixNetHt ?? null;
  const controles: ResultatControle[] = [];

  // 1 — relecture live, écart ≤ seuil avec le prix d'achat en base
  controles.push(controleRelecture(e, p, live));

  // 2 — jamais à perte : achat net HT ≤ prix HT payé par le client
  {
    const ttc = nombre(e.ligne.venteUnitTtc);
    const tva = p?.tauxTva ?? null;
    let r: ResultatControle;
    if (!p) {
      r = bloque(2, 'JAMAIS_A_PERTE', 'aucun fournisseur proposé');
    } else if (net == null) {
      r = bloque(2, 'JAMAIS_A_PERTE', 'prix net live inconnu');
    } else if (ttc == null || ttc <= 0 || tva == null) {
      r = bloque(
        2,
        'JAMAIS_A_PERTE',
        'prix payé ou TVA inconnu : marge non vérifiable',
      );
    } else {
      const venteHt = centimes(ttc / (1 + tva));
      r =
        net <= venteHt
          ? ok(
              2,
              'JAMAIS_A_PERTE',
              `achat ${eur(net)} ≤ vente ${eur(venteHt)} (marge ${eur(centimes(venteHt - net))})`,
            )
          : bloque(
              2,
              'JAMAIS_A_PERTE',
              `vente à perte : achat ${eur(net)} > vente ${eur(venteHt)}`,
            );
    }
    controles.push(r);
  }

  // 3 — carte autorisée, commande non annulée, ligne commandable, case cochée
  {
    const defauts: string[] = [];
    if (!e.commande.estPayee) defauts.push('paiement non autorisé');
    if (e.commande.statut === COMMANDE_ANNULEE)
      defauts.push('commande annulée');
    const interdit = e.ligne.statut ? LIGNE_INTERDITE[e.ligne.statut] : null;
    if (interdit) defauts.push(`ligne ${interdit}`);
    if (!e.demande.compatibiliteVerifiee)
      defauts.push('« compatibilité vérifiée » non cochée');
    controles.push(
      defauts.length
        ? bloque(3, 'CARTE_COMMANDE_COMPATIBILITE', defauts.join(', '))
        : ok(
            3,
            'CARTE_COMMANDE_COMPATIBILITE',
            'paiement autorisé, commande active, compatibilité vérifiée',
          ),
    );
  }

  // 4 — une seule commande fournisseur par ligne
  controles.push(
    e.dejaPreparee
      ? bloque(
          4,
          'UNE_SEULE_COMMANDE',
          'commande fournisseur déjà préparée pour cette ligne',
        )
      : e.ligne.statut === LIGNE_COMMANDEE
        ? bloque(
            4,
            'UNE_SEULE_COMMANDE',
            'ligne déjà commandée chez le fournisseur (statut 6)',
          )
        : ok(4, 'UNE_SEULE_COMMANDE', 'aucune commande préparée sur la ligne'),
  );

  // 5 — quantité de la ligne, jamais plus
  controles.push(
    quantite == null || !Number.isInteger(quantite) || quantite < 1
      ? bloque(5, 'QUANTITE_DE_LA_LIGNE', 'quantité de la ligne illisible')
      : p && p.quantite !== quantite
        ? bloque(
            5,
            'QUANTITE_DE_LA_LIGNE',
            `quantité proposée ${p.quantite} ≠ quantité de la ligne ${quantite}`,
          )
        : ok(
            5,
            'QUANTITE_DE_LA_LIGNE',
            `quantité ${quantite} (celle de la ligne)`,
          ),
  );

  // 6 — plafond HT, seconde confirmation au-dessus
  const montantNetHt =
    net != null && quantite != null ? centimes(net * quantite) : null;
  controles.push(
    montantNetHt == null
      ? bloque(6, 'PLAFOND_HT', 'montant inconnu')
      : montantNetHt <= e.seuils.plafondHt
        ? ok(
            6,
            'PLAFOND_HT',
            `${eur(montantNetHt)} ≤ plafond ${eur(e.seuils.plafondHt)}`,
          )
        : e.demande.confirmationPlafond
          ? ok(
              6,
              'PLAFOND_HT',
              `${eur(montantNetHt)} > plafond ${eur(e.seuils.plafondHt)} : seconde confirmation donnée`,
            )
          : {
              id: 6,
              code: 'PLAFOND_HT',
              statut: 'A_CONFIRMER',
              detail: `${eur(montantNetHt)} > plafond ${eur(e.seuils.plafondHt)} : seconde confirmation requise`,
            },
  );

  // 7 — trace : le service écrit la préparation (ou le refus) dans le journal
  // d'audit AVANT de répondre ; un échec d'écriture lève une erreur.
  controles.push(
    ok(
      7,
      'TRACE',
      'envoi et réponse fournisseur tracés sur la ligne (__admin_audit_log)',
    ),
  );

  // 8 — mode essai : préparée, jamais envoyée
  const numeroEssai = e.essaisDejaPrepares + 1;
  controles.push(
    ok(
      8,
      'MODE_ESSAI',
      numeroEssai <= e.seuils.nombreEssais
        ? `essai ${numeroEssai}/${e.seuils.nombreEssais} : préparée, non envoyée, à comparer à la commande manuelle`
        : `essai ${numeroEssai} (au-delà des ${e.seuils.nombreEssais}) : toujours non envoyée, la bascule relève du mandat d'envoi`,
    ),
  );

  let decision: DecisionPreparation;
  if (e.dejaPreparee) decision = 'DEJA_PREPAREE';
  else if (controles.some((c) => c.statut === 'BLOQUE')) decision = 'BLOQUEE';
  else if (controles.some((c) => c.statut === 'A_CONFIRMER'))
    decision = 'CONFIRMATION_REQUISE';
  else decision = 'PREPAREE';

  return { decision, controles, montantNetHt, numeroEssai };
}

function controleRelecture(
  e: EntreeControles,
  p: Extract<PropositionFournisseur, { statut: 'PROPOSE' }> | null,
  live: Extract<ResultatLecture, { ok: true }> | null,
): ResultatControle {
  const C = 'RELECTURE_LIVE' as const;
  if (!p) {
    return bloque(
      1,
      C,
      e.proposition.statut === 'RUPTURE'
        ? `aucune offre vendable : marquer la ligne en rupture, équivalent selon ${PROCEDURE_RUPTURE}`
        : 'proposition à compléter (prix ou fournisseur manquant)',
    );
  }
  if (!e.lecture || !e.lecture.ok) {
    return bloque(
      1,
      C,
      `relecture du portail impossible (${e.lecture && 'motif' in e.lecture ? e.lecture.motif : 'non lancée'}) : rien ne part sans relecture`,
    );
  }
  if (!live || live.correspondance !== 'EXACTE') {
    return bloque(
      1,
      C,
      live?.correspondance === 'NON_EXACTE'
        ? `référence absente telle quelle chez ${p.nomFournisseur} (portail : ${live.refFournisseur ?? '?'})`
        : `référence introuvable chez ${p.nomFournisseur}`,
    );
  }
  if (!live.disponible) {
    return bloque(
      1,
      C,
      `non disponible chez ${p.nomFournisseur} (${live.detailDispo}) : marquer la ligne en rupture, équivalent selon ${PROCEDURE_RUPTURE}`,
    );
  }
  if (live.prixNetHt == null) {
    return bloque(1, C, 'prix net non lu sur le portail');
  }
  const base = p.prixAchatUnitHt;
  const ecart = base > 0 ? (live.prixNetHt - base) / base : Infinity;
  const pct = Number.isFinite(ecart)
    ? `${(ecart * 100).toFixed(1)} %`
    : 'prix en base nul';
  const seuil = `${(e.seuils.ecartAchatLive * 100).toFixed(0)} %`;
  // Comparaison au centime : 23,40 × 1,05 = 24,57 passe, sans erreur flottante.
  const maxTolere = centimes(base * (1 + e.seuils.ecartAchatLive));
  return base > 0 && live.prixNetHt <= maxTolere
    ? ok(
        1,
        C,
        `disponible, net live ${eur(live.prixNetHt)} vs base ${eur(base)} (écart ${pct} ≤ ${seuil})`,
      )
    : bloque(
        1,
        C,
        `net live ${eur(live.prixNetHt)} vs base ${eur(base)} : écart ${pct} > ${seuil}`,
      );
}

function ok(
  id: ResultatControle['id'],
  code: CodeControle,
  detail: string,
): ResultatControle {
  return { id, code, statut: 'OK', detail };
}
function bloque(
  id: ResultatControle['id'],
  code: CodeControle,
  detail: string,
): ResultatControle {
  return { id, code, statut: 'BLOQUE', detail };
}
