import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  listConnectableSuppliers,
  type SupplierConnectorConfig,
} from './connectors/supplier-registry';
import type {
  DemandeLecture,
  LectureImpossible,
} from './supplier-live-quote.service';
import { SupplierLiveQuoteService } from './supplier-live-quote.service';
import { offreDepuisLecture } from './supplier-offer-releve';
import { type EventSink, noopSink } from './supplier-sync.processor';
import { envMaxRefsPerRun } from './supplier-sync.runner';
import {
  SupplierTruthRepository,
  type LigneAReleve,
} from './supplier-truth.repository';

export interface ReleveSummary {
  /** Lignes de commande à relever (payées, non annulées, sans commande préparée). */
  lignes: number;
  fournisseursLus: number;
  /** Portail en erreur ou lecture impossible : observable, jamais confondu avec « rien à lire ». */
  fournisseursEnEchec: number;
  /** Aucune marque de la ligne portée par ce fournisseur (`___xtr_supplier_link_pm`). */
  fournisseursSansMarque: number;
  lectures: number;
  relevesEcrits: number;
}

/**
 * Relevé planifié des offres (complément BK n° 4) — tourne SEULEMENT sur DEV
 * (`SUPPLIER_OFFER_RELEVE_ENABLED=true`). Pour chaque ligne de commande payée,
 * non annulée et sans commande fournisseur préparée, interroge chaque
 * fournisseur connectable qui porte la marque de la ligne
 * (`___xtr_supplier_link_pm`) et écrit une ligne datée par lecture dans
 * `supplier_offer_snapshot` (append-only). Lecture seule sur les portails
 * (connecteurs de #2148, garde `portal-read-only-guard`).
 *
 * Anti-bannissement : au plus `SUPPLIER_SYNC_MAX_REFS_PER_RUN` références par
 * fournisseur et par passage, lignes les plus récentes d'abord ; une connexion
 * par marque (`lireLot`).
 */
@Injectable()
export class SupplierOfferReleveRunner {
  private readonly logger = new Logger(SupplierOfferReleveRunner.name);

  constructor(
    private readonly repo: SupplierTruthRepository,
    private readonly liveQuote: SupplierLiveQuoteService,
    private readonly emit: EventSink = noopSink,
    private readonly maxRefsParFournisseur: number = envMaxRefsPerRun(),
    private readonly fournisseurs: () => readonly SupplierConnectorConfig[] = listConnectableSuppliers,
  ) {}

  async runReleve(): Promise<ReleveSummary> {
    const runId = randomUUID();
    const lignes = await this.repo.getReleveWorkingSet();
    const resume: ReleveSummary = {
      lignes: lignes.length,
      fournisseursLus: 0,
      fournisseursEnEchec: 0,
      fournisseursSansMarque: 0,
      lectures: 0,
      relevesEcrits: 0,
    };
    if (lignes.length === 0) return resume;

    for (const cfg of this.fournisseurs()) {
      const marques = new Set(
        await this.repo.getSupplierLinkedBrands(cfg.supplierId),
      );
      const items = this.itemsPour(lignes, marques);
      if (items.length === 0) {
        resume.fournisseursSansMarque++;
        continue;
      }
      const lot = items.slice(0, this.maxRefsParFournisseur);
      if (items.length > lot.length) {
        this.logger.log(
          `${cfg.supplierName}: ${items.length} références à relever, ${lot.length} ce passage (SUPPLIER_SYNC_MAX_REFS_PER_RUN=${this.maxRefsParFournisseur})`,
        );
      }

      const demandes: DemandeLecture[] = lot.map((l) => ({
        ref: l.ref,
        marque: l.marque,
      }));
      const resultats = await this.liveQuote.lireLot(cfg.supplierId, demandes);
      resume.lectures += resultats.length;
      const echecs = resultats.filter(
        (r): r is LectureImpossible => 'motif' in r,
      );
      if (echecs.length > 0) {
        resume.fournisseursEnEchec++;
        this.emit('supplier.releve.lecture_impossible', {
          supplierId: cfg.supplierId,
          supplierName: cfg.supplierName,
          echecs: echecs.length,
          lectures: resultats.length,
          motif: echecs[0].motif,
          detail: echecs[0].detail,
          runId,
        });
      }
      if (echecs.length < resultats.length) resume.fournisseursLus++;

      for (let i = 0; i < resultats.length; i++) {
        const r = resultats[i];
        if ('motif' in r) continue;
        await this.repo.insertOffer(offreDepuisLecture(r, lot[i].pieceId));
        resume.relevesEcrits++;
      }
    }
    this.logger.log(
      `relevé : ${resume.lignes} lignes, ${resume.relevesEcrits} relevés écrits, ${resume.fournisseursEnEchec} fournisseur(s) en échec`,
    );
    return resume;
  }

  /** Références distinctes (pièce, réf., marque) dont la marque est portée. */
  private itemsPour(
    lignes: LigneAReleve[],
    marques: Set<number>,
  ): LigneAReleve[] {
    const vues = new Set<string>();
    const items: LigneAReleve[] = [];
    for (const l of lignes) {
      if (l.pmId == null || !marques.has(l.pmId)) continue;
      const cle = `${l.pieceId}|${l.ref}|${l.marque}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      items.push(l);
    }
    return items;
  }
}
