-- Rollback: 20261001_drop_pieces_price_unused_indexes
-- Recrée les 26 index retirés, définitions relevées par `pg_get_indexdef` le 2026-09-30
-- à 22:57Z, avant le retrait. L'engine est forward-only : ce fichier se lance à la
-- main, hors transaction (CONCURRENTLY), une instruction à la fois.
-- CONCURRENTLY : pas de verrou bloquant les écritures sur `pieces_price`, au prix de
-- deux balayages de la table par index (≈ 250 Mo de heap, 476 086 lignes). Timeouts à
-- 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident 20260529, PR #1395).
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer. Le contrôle
-- final liste les index recréés absents ou invalides.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_code_fam_nu
  ON public.pieces_price USING btree (pri_code_fam_nu);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_code_metier
  ON public.pieces_price USING btree (pri_code_metier);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_code_sfam_nu
  ON public.pieces_price USING btree (pri_code_sfam_nu);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_consigne_ht
  ON public.pieces_price USING btree (pri_consigne_ht);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_frais_port_ht
  ON public.pieces_price USING btree (pri_frais_port_ht);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_frais_supp_ht
  ON public.pieces_price USING btree (pri_frais_supp_ht);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_frs_2
  ON public.pieces_price USING btree (pri_frs_2);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_frs_3
  ON public.pieces_price USING btree (pri_frs_3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_frs_4
  ON public.pieces_price USING btree (pri_frs_4);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_hauteur
  ON public.pieces_price USING btree (pri_hauteur);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_insert_type
  ON public.pieces_price USING btree (pri_insert_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_largeur
  ON public.pieces_price USING btree (pri_largeur);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_longueur
  ON public.pieces_price USING btree (pri_longueur);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_qte_vente
  ON public.pieces_price USING btree (pri_qte_vente);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_ref_comp
  ON public.pieces_price USING btree (pri_ref_comp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_remise_2
  ON public.pieces_price USING btree (pri_remise_2);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_remise_3
  ON public.pieces_price USING btree (pri_remise_3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_remise_4
  ON public.pieces_price USING btree (pri_remise_4);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_tva
  ON public.pieces_price USING btree (pri_tva);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_udm_dimentions
  ON public.pieces_price USING btree (pri_udm_dimentions);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_xls
  ON public.pieces_price USING btree (pri_xls);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_date_to
  ON public.pieces_price USING btree (pri_date_to);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_achat_ht
  ON public.pieces_price USING btree (pri_achat_ht);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_gros_ht
  ON public.pieces_price USING btree (pri_gros_ht);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_remise
  ON public.pieces_price USING btree (pri_remise);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_vente_ht
  ON public.pieces_price USING btree (pri_vente_ht);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY[
    'code_fam_nu', 'code_metier', 'code_sfam_nu', 'consigne_ht', 'frais_port_ht',
    'frais_supp_ht', 'frs_2', 'frs_3', 'frs_4', 'hauteur', 'insert_type', 'largeur',
    'longueur', 'qte_vente', 'ref_comp', 'remise_2', 'remise_3', 'remise_4', 'tva',
    'udm_dimentions', 'xls', 'date_to', 'achat_ht', 'gros_ht', 'remise', 'vente_ht'
  ]) AS c(col)
  CROSS JOIN LATERAL (SELECT 'idx_pieces_price_pri_' || c.col AS n) x
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
