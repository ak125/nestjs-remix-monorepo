import { TABLES } from '@repo/database-types';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { PiecePriceDataService } from '@database/services/piece-price-data.service';
import { SupplierTruthRepository } from '../../supplier-truth/supplier-truth.repository';
import {
  lectureDepuisReleve,
  releveEstFrais,
  type ResultatLecture,
} from '../../supplier-truth';
import {
  proposerFournisseur,
  type PropositionFournisseur,
} from './order-line-supplier-proposal';

/** Colonnes de la ligne lues pour la proposition (aucune donnée client). */
const COLONNES_LIGNE = [
  'orl_id',
  'orl_ord_id',
  'orl_pg_id',
  'orl_art_ref',
  'orl_orls_id',
  'orl_art_quantity',
  'orl_art_price_sell_unit_ttc',
  'orl_spl_id',
  'orl_spl_name',
  'orl_spl_date',
  'orl_spl_price_buy_unit_ht',
  'orl_spl_price_buy_ht',
].join(', ');

interface LigneLue {
  orl_id: string;
  orl_ord_id: string;
  orl_pg_id: string | null;
  orl_art_ref: string | null;
  orl_orls_id: string | null;
  orl_art_quantity: string | null;
  orl_art_price_sell_unit_ttc: string | null;
  orl_spl_id: string | null;
  orl_spl_name: string | null;
  orl_spl_date: string | null;
  orl_spl_price_buy_unit_ht: string | null;
  orl_spl_price_buy_ht: string | null;
}

export interface FournisseurConfirme {
  splId: string;
  nom: string | null;
  date: string | null;
  prixAchatUnitHt: string | null;
  prixAchatHt: string | null;
}

export interface PropositionLigne {
  orderId: string;
  lineId: string;
  pieceId: number;
  statutLigne: string | null;
  /** Fournisseur déjà posé sur la ligne (`orl_spl_id` ni vide ni '0'). */
  fournisseurConfirme: FournisseurConfirme | null;
  proposition: PropositionFournisseur;
  /**
   * Dernier relevé (`supplier_offer_snapshot`) du fournisseur proposé, lu par les
   * contrôles 1, 2 et 6 : lecture, ou motif « relevé absent » / « relevé de plus
   * de 30 min ». null sans proposition. Aucun portail n'est appelé.
   */
  releveFournisseurPropose: ResultatLecture | null;
}

/** `orl_spl_id` vide, NULL ou '0' (valeur historique « aucun ») = non posé. */
export const fournisseurPose = (splId: string | null | undefined): boolean =>
  splId != null && splId.trim() !== '' && splId.trim() !== '0';

/**
 * Lecture de la proposition fournisseur d'une ligne de commande (décision 50).
 *
 * Lecture seule : la ligne, les offres VENDABLES de sa pièce (définition unique,
 * décision 51) et l'annuaire `___xtr_supplier` (lu par le module supplier-truth,
 * seul lecteur autorisé). L'écriture (confirmation, rupture) appartient à
 * `OrderActionsService`, autorité du cycle de vie de la ligne.
 */
@Injectable()
export class OrderLineSupplierService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderLineSupplierService.name);

  constructor(
    private readonly piecePriceData: PiecePriceDataService,
    private readonly supplierTruth: SupplierTruthRepository,
  ) {
    super();
  }

  async getProposal(
    orderId: string,
    lineId: string,
  ): Promise<PropositionLigne> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select(COLONNES_LIGNE)
      .eq('orl_id', lineId)
      .eq('orl_ord_id', orderId)
      .maybeSingle();
    if (error) {
      throw new Error(`Lecture de la ligne impossible : ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException('Ligne de commande introuvable');
    }
    const ligne = data as unknown as LigneLue;
    const pieceId = Number(ligne.orl_pg_id);
    if (!Number.isInteger(pieceId) || pieceId <= 0) {
      throw new UnprocessableEntityException(
        'Ligne sans pièce catalogue (orl_pg_id) : proposition impossible',
      );
    }

    const [offres, annuaire, releves] = await Promise.all([
      this.piecePriceData.findSellableOffers(pieceId),
      this.supplierTruth.getSupplierDirectory(),
      this.supplierTruth.readLatestOffers(pieceId),
    ]);
    const maintenant = new Date();
    const proposition = proposerFournisseur(
      offres.map((o) => ({
        libelleFournisseur: o.pri_frs,
        achatHt: o.pri_achat_ht_n,
        venteHt: o.pri_vente_ht_n,
        tauxTva: o.pri_tva_n,
        type: o.pri_type ?? '',
        dateTarif: o.pri_date_from ?? null,
      })),
      annuaire,
      {
        quantite: ligne.orl_art_quantity,
        venteUnitTtc: ligne.orl_art_price_sell_unit_ttc,
      },
      releves.map((r) => ({
        splId: r.supplier_id,
        achatHt: r.achat_ht_cents == null ? null : r.achat_ht_cents / 100,
        disponible: r.available === true,
        exacte: r.parse_confidence === 'HIGH_CONFIDENCE',
        frais: releveEstFrais(r.observed_at, maintenant),
        observeA: r.observed_at,
      })),
    );
    const releveFournisseurPropose =
      proposition.statut === 'PROPOSE'
        ? lectureDepuisReleve(
            releves.find((r) => r.supplier_id === proposition.splId) ?? null,
            proposition.splId,
            (ligne.orl_art_ref ?? '').trim(),
            maintenant,
          )
        : null;

    return {
      orderId: ligne.orl_ord_id,
      lineId: ligne.orl_id,
      pieceId,
      statutLigne: ligne.orl_orls_id,
      fournisseurConfirme: fournisseurPose(ligne.orl_spl_id)
        ? {
            splId: String(ligne.orl_spl_id).trim(),
            nom: ligne.orl_spl_name,
            date: ligne.orl_spl_date,
            prixAchatUnitHt: ligne.orl_spl_price_buy_unit_ht,
            prixAchatHt: ligne.orl_spl_price_buy_ht,
          }
        : null,
      proposition,
      releveFournisseurPropose,
    };
  }
}
