/**
 * SellabilityTruthService — AUTORITÉ APPLICATIVE (TS) du prédicat canonique de vendabilité.
 *
 * Prédicat canonique UNIQUE (PR1 du plan "Activation cohérente véhicule/gamme", 2026-06-13) :
 *   pri_dispo IN ('1','2','3') AND pri_vente_ttc_n > 0 AND piece_display = true
 *
 * Deux autorités verrouillées (le prédicat existe forcément en 2 mondes TS + SQL) :
 *   • ce service = autorité applicative (TS) ;
 *   • SQL : is_piece_sellable() (point-read) + refresh_catalog_sellable_candidates() (agrégat).
 * Verrou anti-divergence = tests croisés TS↔SQL + gardes lint (ast-grep TS + grep SQL migrations).
 * → AUCUN autre service ne doit ré-exprimer un filtre pri_dispo : tout consommateur importe ce service.
 *
 * Granularité (panier ≠ R2) :
 *   • isSellablePiece(pieceId)   → point-read LIVE sur les tables source (panier/prix). Jamais le rollup.
 *   • getAggregate(typeId, pgId) → lecture du rollup __catalog_sellable_candidates (R2/sitemap/sélecteurs).
 *
 * Readiness : tant que isReady()=false (backfill non complet), les consommateurs agrégés gardent
 * leur comportement actuel — JAMAIS de fallback silencieux sur table vide.
 *
 * Lecture seule (PR1). Le refresh (delta/stale/shard) est exposé séparément pour le hook
 * post-commit (PR2/PR3) ; il écrit UNIQUEMENT la projection, jamais le catalogue.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/** Forme canonique documentée du prédicat (référence ; l'exécution passe par le SQL). */
export const CANONICAL_SELLABLE_PREDICATE =
  "pri_dispo IN ('1','2','3') AND pri_vente_ttc_n > 0 AND piece_display = true";

/** Agrégat type×gamme lu depuis le rollup (faits ; le verdict d'indexabilité reste à la politique SEO). */
export interface SellableAggregate {
  typeId: number;
  pgId: number;
  catalogActive: boolean;
  sellableCount: number;
  minPrice: number | null;
  hasPrice: boolean;
  hasDispo: boolean;
  refreshedAt: string | null;
  /** true si la ligne est périmée/jamais calculée (refreshedAt NULL) — le consommateur ne sert pas en silence. */
  stale: boolean;
}

@Injectable()
export class SellabilityTruthService extends SupabaseBaseService {
  private readonly log = new Logger(SellabilityTruthService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Vendabilité PIÈCE (panier/prix) — LIVE, jamais périmé. Lit les tables source via la
   * fonction SQL canonique is_piece_sellable. NE DÉPEND PAS d'un type_id fourni par le client :
   * une pièce vendable ne doit jamais être refusée faute de contexte véhicule.
   */
  async isSellablePiece(pieceId: number): Promise<boolean> {
    if (!Number.isInteger(pieceId) || pieceId <= 0) return false;
    const { data, error } = await this.supabase.rpc('is_piece_sellable', {
      p_piece_id: pieceId,
    });
    if (error) {
      // No silent fallback : on remonte l'erreur (le caller décide), on ne renvoie pas un "true" optimiste.
      this.log.error(`is_piece_sellable(${pieceId}) failed: ${error.message}`);
      throw error;
    }
    return data === true;
  }

  /**
   * Agrégat de vendabilité type×gamme (R2/sitemap/sélecteurs) depuis le rollup.
   * Retourne null si la paire n'est pas (encore) dans la projection.
   */
  async getAggregate(
    typeId: number,
    pgId: number,
  ): Promise<SellableAggregate | null> {
    if (!Number.isInteger(typeId) || !Number.isInteger(pgId)) return null;
    const { data, error } = await this.supabase
      .from('__catalog_sellable_candidates')
      .select(
        'type_id_i, pg_id, catalog_active, sellable_count, price_sellable_count, min_price, has_price, has_dispo, refreshed_at',
      )
      .eq('type_id_i', typeId)
      .eq('pg_id', pgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      typeId: data.type_id_i as number,
      pgId: data.pg_id as number,
      catalogActive: data.catalog_active as boolean,
      sellableCount: data.sellable_count as number,
      minPrice: (data.min_price as number | null) ?? null,
      hasPrice: data.has_price as boolean,
      hasDispo: data.has_dispo as boolean,
      refreshedAt: (data.refreshed_at as string | null) ?? null,
      stale: data.refreshed_at == null,
    };
  }

  /**
   * Readiness du rollup. false → le backfill initial n'est pas complet : les consommateurs
   * agrégés DOIVENT garder leur comportement actuel (pas de fallback silencieux sur table vide).
   */
  async isReady(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('__catalog_sellable_meta')
      .select('ready')
      .eq('singleton', true)
      .maybeSingle();
    if (error) throw error;
    return data?.ready === true;
  }

  /**
   * Déclenche un refresh gouverné de la projection (delta/stale/shard) — écrit UNIQUEMENT
   * __catalog_sellable_candidates. À appeler POST-commit (hors transaction prix), jamais
   * en plein sweep. Retourne le nombre de paires (type,pg) recalculées.
   */
  async refresh(opts: {
    pieceIds?: number[];
    staleOnly?: boolean;
    typeLo?: number;
    typeHi?: number;
    limit?: number;
  }): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'refresh_catalog_sellable_candidates',
      {
        p_piece_ids: opts.pieceIds ?? null,
        p_stale_only: opts.staleOnly ?? false,
        p_type_lo: opts.typeLo ?? null,
        p_type_hi: opts.typeHi ?? null,
        p_limit: opts.limit ?? 5000,
      },
    );
    if (error) throw error;
    return (data as number) ?? 0;
  }

  /**
   * Diagnostic read-only (cheap) du rollup : readiness + stats (pairs total/stale/sellable,
   * strandées par la chaîne display, somme sellable_count, fenêtre refreshed_at). Ne statue
   * PAS sur l'indexabilité (politique SEO). Sert l'endpoint admin de diagnostic.
   */
  async diagnostic(): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase.rpc(
      'catalog_sellable_diagnostic',
    );
    if (error) throw error;
    return (data as Record<string, unknown>) ?? {};
  }
}
