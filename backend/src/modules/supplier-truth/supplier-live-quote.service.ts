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

/**
 * Relecture en direct, sur le portail du fournisseur, d'UNE référence : prix
 * public, remise, prix net et disponibilité (mandat BK, contrôle 1).
 *
 * Lecture seule : la seule surface utilisée est celle des connecteurs de
 * supplier-truth (login, recherche, fermeture), protégés par la garde réseau
 * `portal-read-only-guard`. Ce service n'a aucune méthode de mise au panier ni
 * de commande, et n'écrit rien en base.
 */

export type Correspondance = 'EXACTE' | 'NON_EXACTE' | 'ABSENTE';

export interface LectureLive {
  ok: true;
  splId: string;
  plateforme: SupplierConnectorConfig['platform'];
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
  | 'PORTAIL_EN_ERREUR';

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

const fabriqueParDefaut: FabriqueConnecteur = (cfg, marque) =>
  cfg.platform === 'cal'
    ? new CalConnector({
        supplierId: cfg.supplierId,
        baseUrl: cfg.baseUrl,
        brandTokens: marque ? [marque] : [],
      })
    : new InoshopConnector({
        supplierId: cfg.supplierId,
        baseUrl: cfg.baseUrl,
      });

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
 * Enregistré par fabrique (`useFactory`) dans OrdersModule : les dépendances du
 * constructeur sont des fonctions, injectées explicitement par les tests.
 */
@Injectable()
export class SupplierLiveQuoteService {
  private readonly logger = new Logger(SupplierLiveQuoteService.name);

  constructor(
    private readonly fabrique: FabriqueConnecteur = fabriqueParDefaut,
    private readonly identifiants: CredResolver = envCredResolver,
    private readonly maintenant: () => Date = () => new Date(),
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
    const lueA = this.maintenant().toISOString();
    const cfg = getSupplierConnectorConfig(splId);
    if (!cfg) {
      return {
        ok: false,
        splId,
        motif: 'SANS_CONNECTEUR',
        detail: 'aucun connecteur de lecture pour ce fournisseur',
        lueA,
      };
    }
    const creds = this.identifiants(cfg);
    if (!creds) {
      return {
        ok: false,
        splId,
        motif: 'IDENTIFIANTS_ABSENTS',
        detail: `identifiants ${cfg.credEnv.userKey}/${cfg.credEnv.passKey} absents`,
        lueA,
      };
    }
    const connecteur = this.fabrique(cfg, marque);
    try {
      await connecteur.login(creds);
      if (connecteur instanceof InoshopConnector) {
        const token = await connecteur.getCsrfToken();
        const rows = await connecteur.fetchSearchRows([ref], token);
        return lectureInoshop(cfg, ref, marque, rows, lueA);
      }
      const [obs] = await connecteur.fetchAvailability([ref]);
      const trouve = obs != null && !(obs.parseError && obs.priceBuyHt == null);
      return {
        ok: true,
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
    } catch (e) {
      const message = (e as Error).message.replace(/\s+/g, ' ').slice(0, 200);
      this.logger.warn(`lecture portail ${cfg.supplierName} : ${message}`);
      return {
        ok: false,
        splId,
        motif: 'PORTAIL_EN_ERREUR',
        detail: message,
        lueA,
      };
    } finally {
      await connecteur.close().catch(() => undefined);
    }
  }
}
