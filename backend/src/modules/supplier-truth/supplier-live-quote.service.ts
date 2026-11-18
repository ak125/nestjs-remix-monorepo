import { Injectable, Logger } from '@nestjs/common';
import { CalConnector } from './connectors/cal.connector';
import { normalizeCalRef } from './connectors/cal-parse';
import { InoshopConnector } from './connectors/inoshop.connector';
import {
  brandTokenSet,
  classifyForActivation,
  isBrandRow,
  matchBrandRow,
  type SearchRow,
} from './connectors/inoshop-search-parse';
import {
  getSupplierConnectorConfig,
  type SupplierConnectorConfig,
} from './connectors/supplier-registry';
import { envCredResolver, type CredResolver } from './supplier-sync.runner';
import {
  assertLecturePortailsAutorisee,
  isSupplierOfferReleveEnabled,
} from './supplier-sync.flag';

/**
 * Lecture, sur le portail d'un fournisseur, de références : prix public, remise,
 * prix net et disponibilité (mandat BK ; complément n° 4 du 18/11/2026).
 *
 * Depuis le complément n° 4, ce service ne sert plus qu'au relevé planifié du
 * processus DEV (`SupplierOfferReleveRunner`), qui écrit ses lectures dans
 * `supplier_offer_snapshot`. La PROD ne l'instancie pas : la préparation de
 * commande lit le dernier relevé (`lectureDepuisReleve`). Garde PROD : sans
 * `SUPPLIER_OFFER_RELEVE_ENABLED=true` dans le processus, aucune lecture n'est
 * tentée et aucun connecteur ne se construit, même avec des identifiants.
 *
 * Lecture seule : la seule surface utilisée est celle des connecteurs de
 * supplier-truth (login, recherche, fermeture), protégés par la garde réseau
 * `portal-read-only-guard`. Ce service n'a aucune méthode de mise au panier ni
 * de commande, et n'écrit rien en base.
 */

export type Correspondance = 'EXACTE' | 'NON_EXACTE' | 'ABSENTE';

export interface LectureLive {
  ok: true;
  /** PORTAIL : lue à l'instant ; RELEVE : dernier relevé de `supplier_offer_snapshot`. */
  source: 'PORTAIL' | 'RELEVE';
  splId: string;
  /** null : relevé d'un fournisseur sans connecteur déclaré dans ce code. */
  plateforme: SupplierConnectorConfig['platform'] | null;
  refDemandee: string;
  /** Référence telle que le portail la porte (inoshop) ; null pour CAL. */
  refFournisseur: string | null;
  correspondance: Correspondance;
  prixPublicHt: number | null;
  remisePct: number | null;
  /** Remise complémentaire (inoshop `data-Filtreremise2`) ; null si absente. */
  remise2Pct: number | null;
  prixNetHt: number | null;
  disponible: boolean;
  delaiJours: number | null;
  /** Signal de disponibilité brut (classement inoshop ou CAL). */
  detailDispo: string;
  lueA: string;
}

export type MotifLectureImpossible =
  | 'SANS_CONNECTEUR'
  | 'IDENTIFIANTS_ABSENTS'
  | 'PORTAIL_EN_ERREUR'
  /** Processus non autorisé à lire les portails (PROD). */
  | 'LECTURE_PORTAIL_INTERDITE'
  /** Aucun relevé du fournisseur pour la pièce de la ligne. */
  | 'RELEVE_ABSENT'
  /** Dernier relevé plus vieux que `FRAICHEUR_RELEVE_MAX_MINUTES`. */
  | 'RELEVE_PERIME';

export interface DemandeLecture {
  ref: string;
  marque: string;
}

export interface LectureImpossible {
  ok: false;
  splId: string;
  motif: MotifLectureImpossible;
  detail: string;
  lueA: string;
}

export type ResultatLecture = LectureLive | LectureImpossible;

export type FabriqueConnecteur = (
  cfg: SupplierConnectorConfig,
  marque: string,
) => CalConnector | InoshopConnector;

const fabriqueParDefaut: FabriqueConnecteur = (cfg, marque) => {
  // Garde PROD, au plus près de la construction du connecteur réel.
  assertLecturePortailsAutorisee();
  return cfg.platform === 'cal'
    ? new CalConnector({
        supplierId: cfg.supplierId,
        baseUrl: cfg.baseUrl,
        brandTokens: marque ? [marque] : [],
      })
    : new InoshopConnector({
        supplierId: cfg.supplierId,
        baseUrl: cfg.baseUrl,
      });
};

const compacte = (ref: string): string => normalizeCalRef(ref);

/** Ligne inoshop → lecture (prix et dispo de la ligne de la marque). */
function lectureInoshop(
  cfg: SupplierConnectorConfig,
  refDemandee: string,
  marque: string,
  rows: SearchRow[],
  lueA: string,
): LectureLive {
  const tokens = brandTokenSet({ tokens: marque ? [marque] : [] });
  const { row } = matchBrandRow(rows, compacte(refDemandee), null, tokens);
  const base = {
    ok: true as const,
    source: 'PORTAIL' as const,
    splId: cfg.supplierId,
    plateforme: cfg.platform,
    refDemandee,
    lueA,
  };
  if (row) {
    const { bucket, reason } = classifyForActivation(row);
    return {
      ...base,
      refFournisseur: row.refFournisseur,
      correspondance: 'EXACTE',
      prixPublicHt: row.prixPublic ?? null,
      remisePct: row.remise1 ?? null,
      remise2Pct: row.remise2 ?? null,
      prixNetHt: row.prixAchat ?? null,
      disponible: bucket === 'CONFIRMED_AG' || bucket === 'CONFIRMED_GRP',
      delaiJours: null,
      detailDispo: `${bucket} (${reason})`,
    };
  }
  // Ligne de la marque sous une autre référence (ex. ATE 602726 pour
  // 13.0460-2726.2) : montrée, jamais retenue.
  const autre = rows.find((r) => isBrandRow(r, tokens));
  return {
    ...base,
    refFournisseur: autre?.refFournisseur ?? null,
    correspondance: autre ? 'NON_EXACTE' : 'ABSENTE',
    prixPublicHt: autre?.prixPublic ?? null,
    remisePct: autre?.remise1 ?? null,
    remise2Pct: autre?.remise2 ?? null,
    prixNetHt: autre?.prixAchat ?? null,
    disponible: false,
    delaiJours: null,
    detailDispo: autre ? 'référence différente' : 'introuvable',
  };
}

/**
 * Enregistré par fabrique (`useFactory`) dans WorkerModule : les dépendances du
 * constructeur sont des fonctions, injectées explicitement par les tests.
 */
@Injectable()
export class SupplierLiveQuoteService {
  private readonly logger = new Logger(SupplierLiveQuoteService.name);

  constructor(
    private readonly fabrique: FabriqueConnecteur = fabriqueParDefaut,
    private readonly identifiants: CredResolver = envCredResolver,
    private readonly maintenant: () => Date = () => new Date(),
    /** Garde PROD : ce processus peut-il lire un portail ? */
    private readonly autorise: () => boolean = () =>
      isSupplierOfferReleveEnabled(),
  ) {}

  /** Vrai si un connecteur de lecture existe pour ce fournisseur. */
  aUnConnecteur(splId: string): boolean {
    return getSupplierConnectorConfig(splId) != null;
  }

  async lire(
    splId: string,
    ref: string,
    marque: string,
  ): Promise<ResultatLecture> {
    const [resultat] = await this.lireLot(splId, [{ ref, marque }]);
    return resultat;
  }

  /**
   * Lit plusieurs références chez un fournisseur, un résultat par demande, dans
   * l'ordre. Une connexion par marque (CAL filtre la marque à la construction
   * du connecteur), et non une par référence : anti-bannissement.
   */
  async lireLot(
    splId: string,
    demandes: DemandeLecture[],
  ): Promise<ResultatLecture[]> {
    const impossible = (
      motif: MotifLectureImpossible,
      detail: string,
    ): ResultatLecture[] =>
      demandes.map(() => ({
        ok: false,
        splId,
        motif,
        detail,
        lueA: this.maintenant().toISOString(),
      }));
    if (demandes.length === 0) return [];
    if (!this.autorise()) {
      return impossible(
        'LECTURE_PORTAIL_INTERDITE',
        'lecture des portails interdite dans ce processus : seul DEV relève',
      );
    }
    const cfg = getSupplierConnectorConfig(splId);
    if (!cfg) {
      return impossible(
        'SANS_CONNECTEUR',
        'aucun connecteur de lecture pour ce fournisseur',
      );
    }
    const creds = this.identifiants(cfg);
    if (!creds) {
      return impossible(
        'IDENTIFIANTS_ABSENTS',
        `identifiants ${cfg.credEnv.userKey}/${cfg.credEnv.passKey} absents`,
      );
    }

    const parMarque = new Map<string, number[]>();
    demandes.forEach((d, i) => {
      const indices = parMarque.get(d.marque) ?? [];
      indices.push(i);
      parMarque.set(d.marque, indices);
    });

    const resultats: ResultatLecture[] = new Array(demandes.length);
    for (const [marque, indices] of parMarque) {
      let connecteur: CalConnector | InoshopConnector | null = null;
      try {
        connecteur = this.fabrique(cfg, marque);
        await connecteur.login(creds);
        const jeton =
          connecteur instanceof InoshopConnector
            ? await connecteur.getCsrfToken()
            : null;
        for (const i of indices) {
          try {
            resultats[i] = await this.lireUne(
              cfg,
              connecteur,
              jeton,
              demandes[i].ref,
              marque,
            );
          } catch (e) {
            resultats[i] = this.enErreur(cfg, e);
          }
        }
      } catch (e) {
        for (const i of indices) resultats[i] ??= this.enErreur(cfg, e);
      } finally {
        await connecteur?.close().catch(() => undefined);
      }
    }
    return resultats;
  }

  private async lireUne(
    cfg: SupplierConnectorConfig,
    connecteur: CalConnector | InoshopConnector,
    jeton: string | null,
    ref: string,
    marque: string,
  ): Promise<LectureLive> {
    const lueA = this.maintenant().toISOString();
    if (connecteur instanceof InoshopConnector) {
      const rows = await connecteur.fetchSearchRows([ref], jeton ?? '');
      return lectureInoshop(cfg, ref, marque, rows, lueA);
    }
    const [obs] = await connecteur.fetchAvailability([ref]);
    const trouve = obs != null && !(obs.parseError && obs.priceBuyHt == null);
    return {
      ok: true,
      source: 'PORTAIL',
      splId: cfg.supplierId,
      plateforme: cfg.platform,
      refDemandee: ref,
      refFournisseur: null,
      correspondance: trouve ? 'EXACTE' : 'ABSENTE',
      prixPublicHt: obs?.priceBaseHt ?? null,
      remisePct: obs?.remisePct ?? null,
      remise2Pct: null,
      prixNetHt: obs?.priceBuyHt ?? null,
      disponible: trouve && obs.available,
      delaiJours: obs?.delayDays ?? null,
      detailDispo: trouve
        ? obs.available
          ? 'disponible'
          : obs.delayDays != null
            ? `sur commande, délai ${obs.delayDays} j`
            : 'indisponible'
        : 'introuvable',
      lueA,
    };
  }

  private enErreur(
    cfg: SupplierConnectorConfig,
    e: unknown,
  ): LectureImpossible {
    const message = (e as Error).message.replace(/\s+/g, ' ').slice(0, 200);
    this.logger.warn(`lecture portail ${cfg.supplierName} : ${message}`);
    return {
      ok: false,
      splId: cfg.supplierId,
      motif: 'PORTAIL_EN_ERREUR',
      detail: message,
      lueA: this.maintenant().toISOString(),
    };
  }
}
