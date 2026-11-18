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
import { fournisseurPose } from './order-line-supplier.service';
import {
  classerEquivalents,
  preuveReference,
  recherchesCandidats,
  texteMailEquivalent,
  typeVehiculeDepuisUrl,
  TOLERANCE_DIMENSION_MM,
  type CritereLu,
  type DefinitionCritere,
  type Equivalent,
  type PieceCandidate,
  type RefCatalogue,
  type ResultatEquivalents,
  type TypeVehiculeLigne,
} from './rupture-equivalents';

/** Statut de ligne « Pièce non disponible » (même valeur qu'`OrderActionsService`). */
const STATUT_RUPTURE = '4';

/** Trace de l'équivalent retenu dans `__admin_audit_log` (entité `order_line`). */
export const ACTION_EQUIVALENT_RETENU = 'rupture_equivalent_retained';
const ENTITE = 'order_line';

/** Borne PostgREST : toute lecture qui peut la dépasser est paginée. */
const PAGE = 1000;
/** Identifiants par requête `in(...)` (longueur d'URL bornée). */
const LOT_IDS = 200;
/** Pièces par lecture de critères (~20 critères par pièce, puis pagination). */
const LOT_CRITERES = 40;

const COLONNES_LIGNE = [
  'orl_id',
  'orl_ord_id',
  'orl_pg_id',
  'orl_orls_id',
  'orl_pm_name',
  'orl_art_ref',
  'orl_art_quantity',
  'orl_art_price_sell_unit_ttc',
  'orl_art_price_sell_ttc',
  'orl_art_deposit_ttc',
  'orl_website_url',
  'orl_spl_id',
].join(', ');

interface LigneLue {
  orl_id: string;
  orl_ord_id: string;
  orl_pg_id: string | null;
  orl_orls_id: string | null;
  orl_pm_name: string | null;
  orl_art_ref: string | null;
  orl_art_quantity: string | null;
  orl_art_price_sell_unit_ttc: string | null;
  orl_art_price_sell_ttc: string | null;
  orl_art_deposit_ttc: string | null;
  orl_website_url: string | null;
  orl_spl_id: string | null;
}

interface PieceLue {
  piece_id: number;
  piece_ref: string | null;
  piece_pm_id: number | null;
  piece_pg_id: number | null;
  piece_display: boolean | null;
}

export interface EquivalentRetenu {
  traceId: string;
  le: string;
  par: string | null;
  pieceId: number;
  marque: string | null;
  ref: string | null;
  splId: string;
  fournisseur: string;
  prixAchatUnitHt: number;
  prixAchatHt: number;
  quantite: number;
  dateTarif: string | null;
}

export type MotifSansRecherche =
  /** La ligne n'est pas au statut 4 « Pièce non disponible ». */
  | 'LIGNE_NON_RUPTURE'
  /** Page d'ajout sans véhicule (recherche, autre forme d'URL) : rien n'est deviné. */
  | 'TYPE_VEHICULE_INCONNU';

export interface VueEquivalents {
  orderId: string;
  lineId: string;
  pieceId: number;
  statutLigne: string | null;
  commandee: { marque: string | null; ref: string | null };
  typeVehicule: TypeVehiculeLigne | null;
  toleranceMm: number;
  sansRecherche: MotifSansRecherche | null;
  resultat:
    | (Omit<ResultatEquivalents, 'equivalents'> & {
        equivalents: (Equivalent & {
          texteMail: { objet: string; corps: string };
        })[];
      })
    | null;
  /** Fournisseur déjà posé sur la ligne : plus rien n'est retenable. */
  fournisseurPose: boolean;
  /** Dernier équivalent retenu pour cette ligne (trace). */
  retenu: EquivalentRetenu | null;
}

type Reponse = { data: unknown[] | null; error: { message: string } | null };

const decouper = <T>(xs: T[], n: number): T[][] => {
  const lots: T[][] = [];
  for (let i = 0; i < xs.length; i += n) lots.push(xs.slice(i, i + n));
  return lots;
};

/**
 * Lecture des équivalents d'une ligne en rupture (mandat CL).
 *
 * Lecture seule : la ligne, le catalogue (`pieces`, `pieces_ref_search`,
 * `pieces_relation_type`, `pieces_criteria`, `pieces_criteria_link`,
 * `pieces_marque`), les offres vendables (`PiecePriceDataService`, définition
 * unique, décision 51) et l'annuaire fournisseurs (supplier-truth). Le
 * classement est fait par les fonctions pures de `rupture-equivalents.ts`.
 * L'écriture (équivalent retenu) appartient à `OrderActionsService`.
 *
 * Relevé fournisseur (`supplier_offer_snapshot`, #2166) : non lu ici tant que
 * son lecteur n'est pas sur main ; le prix d'achat vient du tarif en base et sa
 * date est affichée.
 */
@Injectable()
export class RuptureEquivalentsService extends SupabaseBaseService {
  protected readonly logger = new Logger(RuptureEquivalentsService.name);

  constructor(
    private readonly piecePriceData: PiecePriceDataService,
    private readonly supplierTruth: SupplierTruthRepository,
  ) {
    super();
  }

  async getEquivalents(
    orderId: string,
    lineId: string,
  ): Promise<VueEquivalents> {
    const ligne = await this.lireLigne(orderId, lineId);
    const pieceId = Number(ligne.orl_pg_id);
    if (!Number.isInteger(pieceId) || pieceId <= 0) {
      throw new UnprocessableEntityException(
        'Ligne sans pièce catalogue (orl_pg_id) : équivalents impossibles',
      );
    }
    const typeVehicule = typeVehiculeDepuisUrl(ligne.orl_website_url);
    const statut = (ligne.orl_orls_id ?? '').trim();
    const retenu = await this.dernierRetenu(ligne.orl_id);
    const base: VueEquivalents = {
      orderId: ligne.orl_ord_id,
      lineId: ligne.orl_id,
      pieceId,
      statutLigne: ligne.orl_orls_id,
      commandee: { marque: ligne.orl_pm_name, ref: ligne.orl_art_ref },
      typeVehicule,
      toleranceMm: TOLERANCE_DIMENSION_MM,
      sansRecherche: null,
      resultat: null,
      fournisseurPose: fournisseurPose(ligne.orl_spl_id),
      retenu,
    };
    if (statut !== STATUT_RUPTURE) {
      return { ...base, sansRecherche: 'LIGNE_NON_RUPTURE' };
    }
    if (!typeVehicule) {
      return { ...base, sansRecherche: 'TYPE_VEHICULE_INCONNU' };
    }

    const [commandeeLue] = await this.lirePieces([pieceId]);
    if (!commandeeLue) {
      throw new UnprocessableEntityException(
        `Pièce ${pieceId} absente du catalogue : équivalents impossibles`,
      );
    }
    const refsCommandee = await this.lireRefsPiece(pieceId);
    const refsParCandidat = await this.lireRefsCandidats(
      recherchesCandidats(refsCommandee),
    );
    refsParCandidat.delete(pieceId);

    // Préfiltre (même ordre que `classerEquivalents`) : critères et tarifs ne
    // sont lus que pour les candidats qui peuvent encore être proposés.
    const avecPreuve = [...refsParCandidat.entries()]
      .filter(([, refs]) => preuveReference(refsCommandee, refs) != null)
      .map(([id]) => id);
    const pieces = new Map(
      (await this.lirePieces(avecPreuve)).map((p) => [p.piece_id, p]),
    );
    const memeGamme = avecPreuve.filter(
      (id) =>
        pieces.get(id)?.piece_pg_id === commandeeLue.piece_pg_id &&
        pieces.get(id)?.piece_display === true,
    );
    const couverts = await this.lireCouverts(typeVehicule.typeId, memeGamme);
    const aComparer = memeGamme.filter((id) => couverts.has(id));

    const [criteres, tarifs, annuaire, marques] = await Promise.all([
      this.lireCriteres([pieceId, ...aComparer]),
      this.piecePriceData.findTariffs(aComparer),
      this.supplierTruth.getSupplierDirectory(),
      this.lireMarques(
        avecPreuve
          .map((id) => pieces.get(id)?.piece_pm_id)
          .filter((x): x is number => x != null),
      ),
    ]);
    const definitions = await this.lireDefinitions(commandeeLue.piece_pg_id, [
      ...new Set([...criteres.values()].flat().map((c) => c.criId)),
    ]);

    const candidats: PieceCandidate[] = avecPreuve.map((id) => {
      const p = pieces.get(id);
      return {
        pieceId: id,
        ref: p?.piece_ref ?? null,
        marque:
          p?.piece_pm_id != null ? (marques.get(p.piece_pm_id) ?? null) : null,
        gammeId: p?.piece_pg_id ?? null,
        affichee: p?.piece_display === true,
        refs: refsParCandidat.get(id) ?? [],
        criteres: criteres.get(id) ?? [],
        couvreTypeLigne: couverts.has(id),
        offres: (tarifs.offresVendables.get(id) ?? []).map((o) => ({
          libelleFournisseur: o.pri_frs,
          achatHt: o.pri_achat_ht_n,
          venteHt: o.pri_vente_ht_n,
          tauxTva: o.pri_tva_n,
          type: o.pri_type ?? '',
          venteTtc: o.pri_vente_ttc_n,
          consigneTtc: o.pri_consigne_ttc_n,
          dateTarif: o.pri_date_from ?? null,
        })),
      };
    });

    const totalPaye =
      ligne.orl_art_price_sell_ttc == null
        ? null
        : Number(ligne.orl_art_price_sell_ttc) +
          (Number(ligne.orl_art_deposit_ttc) || 0);
    const resultat = classerEquivalents(
      {
        pieceId,
        gammeId: commandeeLue.piece_pg_id,
        refs: refsCommandee,
        criteres: criteres.get(pieceId) ?? [],
      },
      typeVehicule,
      {
        quantite: ligne.orl_art_quantity,
        venteUnitTtc: ligne.orl_art_price_sell_unit_ttc,
        totalPayeTtc: totalPaye,
      },
      candidats,
      definitions,
      annuaire,
    );
    this.logger.log(
      `Ligne ${ligne.orl_id} : ${resultat.equivalents.length} équivalent(s), écartés ${JSON.stringify(resultat.ecartes)}`,
    );
    return {
      ...base,
      resultat: {
        ...resultat,
        equivalents: resultat.equivalents.map((e) => ({
          ...e,
          texteMail: texteMailEquivalent({
            orderId: ligne.orl_ord_id,
            marqueCommandee: ligne.orl_pm_name,
            refCommandee: ligne.orl_art_ref,
            quantite: e.achat.quantite,
            equivalent: e,
            type: typeVehicule,
          }),
        })),
      },
    };
  }

  /** Dernière trace d'équivalent retenu pour la ligne, ou null. */
  async dernierRetenu(lineId: string): Promise<EquivalentRetenu | null> {
    const { data, error } = await this.supabase
      .from('__admin_audit_log')
      .select('aal_id, aal_user_id, aal_new_value, aal_created_at')
      .eq('aal_action', ACTION_EQUIVALENT_RETENU)
      .eq('aal_entity_type', ENTITE)
      .eq('aal_entity_id', lineId)
      .order('aal_created_at', { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`Lecture de la trace impossible : ${error.message}`);
    }
    const t = (data ?? [])[0] as
      | {
          aal_id: string;
          aal_user_id: string | null;
          aal_new_value: Omit<EquivalentRetenu, 'traceId' | 'le' | 'par'>;
          aal_created_at: string;
        }
      | undefined;
    return t
      ? {
          traceId: String(t.aal_id),
          le: t.aal_created_at,
          par: t.aal_user_id,
          ...t.aal_new_value,
        }
      : null;
  }

  // ─── Lectures bornées ──────────────────────────────────────────────────────

  /** Lit toutes les pages d'une requête ordonnée ; erreur explicite, jamais de vide. */
  private async toutesLesPages(
    quoi: string,
    page: (de: number, a: number) => PromiseLike<Reponse>,
  ): Promise<unknown[]> {
    const lignes: unknown[] = [];
    for (let de = 0; ; de += PAGE) {
      const { data, error } = await page(de, de + PAGE - 1);
      if (error) {
        throw new Error(`Lecture ${quoi} impossible : ${error.message}`);
      }
      lignes.push(...(data ?? []));
      if (!data || data.length < PAGE) return lignes;
    }
  }

  private async lireLigne(orderId: string, lineId: string): Promise<LigneLue> {
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
    return data as unknown as LigneLue;
  }

  private async lirePieces(ids: number[]): Promise<PieceLue[]> {
    const lus: PieceLue[] = [];
    for (const lot of decouper(ids, LOT_IDS)) {
      const { data, error } = await this.supabase
        .from(TABLES.pieces)
        .select('piece_id, piece_ref, piece_pm_id, piece_pg_id, piece_display')
        .in('piece_id', lot)
        .limit(LOT_IDS);
      if (error) {
        throw new Error(`Lecture des pièces impossible : ${error.message}`);
      }
      lus.push(...((data ?? []) as unknown as PieceLue[]));
    }
    return lus;
  }

  private async lireRefsPiece(pieceId: number): Promise<RefCatalogue[]> {
    const lignes = await this.toutesLesPages('des références', (de, a) =>
      this.supabase
        .from(TABLES.pieces_ref_search)
        .select('prs_kind, prs_search, prs_ref')
        .eq('prs_piece_id', String(pieceId))
        .order('prs_search')
        .order('prs_kind')
        .range(de, a),
    );
    return (
      lignes as {
        prs_kind: string;
        prs_search: string;
        prs_ref: string | null;
      }[]
    ).map((r) => ({ kind: r.prs_kind, search: r.prs_search, ref: r.prs_ref }));
  }

  /**
   * Pièces qui portent au moins une des recherches de la pièce commandée, avec
   * les seules lignes concordantes : ce sont exactement celles dont dépend la
   * preuve de référence croisée.
   */
  private async lireRefsCandidats(
    recherches: string[],
  ): Promise<Map<number, RefCatalogue[]>> {
    const parPiece = new Map<number, RefCatalogue[]>();
    for (const lot of decouper(recherches, LOT_IDS)) {
      const lignes = await this.toutesLesPages(
        'des références croisées',
        (de, a) =>
          this.supabase
            .from(TABLES.pieces_ref_search)
            .select('prs_piece_id, prs_kind, prs_search, prs_ref')
            .in('prs_search', lot)
            .order('prs_piece_id')
            .order('prs_search')
            .order('prs_kind')
            .range(de, a),
      );
      for (const r of lignes as {
        prs_piece_id: string;
        prs_kind: string;
        prs_search: string;
        prs_ref: string | null;
      }[]) {
        const id = Number(r.prs_piece_id);
        if (!Number.isInteger(id) || id <= 0) continue;
        parPiece.set(id, [
          ...(parPiece.get(id) ?? []),
          { kind: r.prs_kind, search: r.prs_search, ref: r.prs_ref },
        ]);
      }
    }
    return parPiece;
  }

  private async lireCouverts(
    typeId: number,
    ids: number[],
  ): Promise<Set<number>> {
    const couverts = new Set<number>();
    for (const lot of decouper(ids, LOT_IDS)) {
      const { data, error } = await this.supabase
        .from(TABLES.pieces_relation_type)
        .select('rtp_piece_id')
        .eq('rtp_type_id', typeId)
        .in('rtp_piece_id', lot)
        .limit(LOT_IDS);
      if (error) {
        throw new Error(
          `Lecture des types véhicule impossible : ${error.message}`,
        );
      }
      for (const r of (data ?? []) as unknown as { rtp_piece_id: number }[]) {
        couverts.add(Number(r.rtp_piece_id));
      }
    }
    return couverts;
  }

  private async lireCriteres(ids: number[]): Promise<Map<number, CritereLu[]>> {
    const parPiece = new Map<number, CritereLu[]>();
    for (const lot of decouper(ids, LOT_CRITERES)) {
      const lignes = await this.toutesLesPages('des critères', (de, a) =>
        this.supabase
          .from(TABLES.pieces_criteria)
          .select('pc_piece_id, pc_cri_id, pc_cri_value')
          .in('pc_piece_id', lot.map(String))
          .order('pc_piece_id')
          .order('pc_pg_pid')
          .order('pc_cri_id')
          .order('pc_cri_value')
          .range(de, a),
      );
      for (const r of lignes as {
        pc_piece_id: string;
        pc_cri_id: string;
        pc_cri_value: string;
      }[]) {
        const id = Number(r.pc_piece_id);
        parPiece.set(id, [
          ...(parPiece.get(id) ?? []),
          { criId: String(r.pc_cri_id), valeur: r.pc_cri_value },
        ]);
      }
    }
    return parPiece;
  }

  /**
   * Définitions des critères dans la gamme. `pieces_criteria_link` peut porter
   * plusieurs lignes par critère (une par gamme parente) : la première dans
   * l'ordre de la clé fait foi.
   */
  private async lireDefinitions(
    gammeId: number | null,
    criIds: string[],
  ): Promise<Map<string, DefinitionCritere>> {
    const defs = new Map<string, DefinitionCritere>();
    if (gammeId == null) return defs;
    for (const lot of decouper(criIds, LOT_IDS)) {
      const lignes = await this.toutesLesPages(
        'des définitions de critères',
        (de, a) =>
          this.supabase
            .from(TABLES.pieces_criteria_link)
            .select('pcl_cri_id, pcl_cri_criteria, pcl_cri_unit, pcl_cri_type')
            .eq('pcl_pg_id', String(gammeId))
            .in('pcl_cri_id', lot)
            .order('pcl_pg_pid')
            .order('pcl_cri_id')
            .range(de, a),
      );
      for (const r of lignes as {
        pcl_cri_id: string;
        pcl_cri_criteria: string | null;
        pcl_cri_unit: string | null;
        pcl_cri_type: string | null;
      }[]) {
        if (defs.has(r.pcl_cri_id)) continue;
        defs.set(r.pcl_cri_id, {
          criId: r.pcl_cri_id,
          libelle:
            (r.pcl_cri_criteria ?? '').trim() || `Critère ${r.pcl_cri_id}`,
          unite: r.pcl_cri_unit,
          type: r.pcl_cri_type,
        });
      }
    }
    return defs;
  }

  private async lireMarques(pmIds: number[]): Promise<Map<number, string>> {
    const marques = new Map<number, string>();
    for (const lot of decouper([...new Set(pmIds)], LOT_IDS)) {
      const { data, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name')
        .in('pm_id', lot)
        .limit(LOT_IDS);
      if (error) {
        throw new Error(`Lecture des marques impossible : ${error.message}`);
      }
      for (const m of (data ?? []) as unknown as {
        pm_id: number;
        pm_name: string | null;
      }[]) {
        if (m.pm_name) marques.set(Number(m.pm_id), m.pm_name);
      }
    }
    return marques;
  }
}
