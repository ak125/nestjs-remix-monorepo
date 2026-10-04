-- Rollback: 20261003_drop_indexes_shadowed_by_unique_commerce
-- Recrée les 24 index ordinaires retirés, définitions relevées par `pg_get_indexdef` le
-- 2026-10-03 à 08:05Z, avant le retrait. L'engine est forward-only : ce fichier se lance
-- à la main, hors transaction (CONCURRENTLY), une instruction à la fois.
-- CONCURRENTLY : pas de verrou bloquant les écritures, au prix de deux balayages de la
-- table par index. Timeouts à 0 : un GUC omis hérite des 60 s du rôle `postgres`
-- (incident 20260529, PR #1395). Chaque index recréé double à nouveau son jumeau unique,
-- qui n'a pas bougé : le retour arrière ne rend aucun plan, seulement l'index.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer. Le contrôle
-- final liste les index recréés absents ou invalides.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____config_cnf_id
  ON public.___config USING btree (cnf_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____config_admin_cnfa_id
  ON public.___config_admin USING btree (cnfa_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____config_ip_cnfip_id
  ON public.___config_ip USING btree (cnfip_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_customer_cst_id
  ON public.___xtr_customer USING btree (cst_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_customer_billing_address_cba_id
  ON public.___xtr_customer_billing_address USING btree (cba_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_customer_delivery_address_cda_id
  ON public.___xtr_customer_delivery_address USING btree (cda_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_delivery_agent_da_id
  ON public.___xtr_delivery_agent USING btree (da_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_delivery_ape_corse_tpg_id
  ON public.___xtr_delivery_ape_corse USING btree (tpg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_delivery_ape_domtom1_tpg_id
  ON public.___xtr_delivery_ape_domtom1 USING btree (tpg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_delivery_ape_domtom2_tpg_id
  ON public.___xtr_delivery_ape_domtom2 USING btree (tpg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_delivery_ape_france_tpg_id
  ON public.___xtr_delivery_ape_france USING btree (tpg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_invoice_inv_id
  ON public.___xtr_invoice USING btree (inv_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_invoice_line_invl_id
  ON public.___xtr_invoice_line USING btree (invl_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_order_ord_id
  ON public.___xtr_order USING btree (ord_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_order_line_orl_id
  ON public.___xtr_order_line USING btree (orl_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_order_line_equiv_ticket_orlet_id
  ON public.___xtr_order_line_equiv_ticket USING btree (orlet_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_order_line_status_orls_id
  ON public.___xtr_order_line_status USING btree (orls_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_order_status_ords_id
  ON public.___xtr_order_status USING btree (ords_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_supplier_spl_id
  ON public.___xtr_supplier USING btree (spl_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____xtr_supplier_link_pm_slpm_id
  ON public.___xtr_supplier_link_pm USING btree (slpm_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ace_recovery_token
  ON public.__abandoned_cart_emails USING btree (recovery_token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ic_postback_id_ic_postback
  ON public.ic_postback USING btree (id_ic_postback);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_resets_token
  ON public.password_resets USING btree (token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_codes_code
  ON public.promo_codes USING btree (code);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY[
    'idx____config_cnf_id', 'idx____config_admin_cnfa_id',
    'idx____config_ip_cnfip_id', 'idx____xtr_customer_cst_id',
    'idx____xtr_customer_billing_address_cba_id', 'idx____xtr_customer_delivery_address_cda_id',
    'idx____xtr_delivery_agent_da_id', 'idx____xtr_delivery_ape_corse_tpg_id',
    'idx____xtr_delivery_ape_domtom1_tpg_id', 'idx____xtr_delivery_ape_domtom2_tpg_id',
    'idx____xtr_delivery_ape_france_tpg_id', 'idx____xtr_invoice_inv_id',
    'idx____xtr_invoice_line_invl_id', 'idx____xtr_order_ord_id',
    'idx____xtr_order_line_orl_id', 'idx____xtr_order_line_equiv_ticket_orlet_id',
    'idx____xtr_order_line_status_orls_id', 'idx____xtr_order_status_ords_id',
    'idx____xtr_supplier_spl_id', 'idx____xtr_supplier_link_pm_slpm_id',
    'idx_ace_recovery_token', 'idx_ic_postback_id_ic_postback',
    'idx_password_resets_token', 'idx_promo_codes_code'
  ]) AS x(n)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
