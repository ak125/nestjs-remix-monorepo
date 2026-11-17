-- =============================================================================
-- Migration : immatriculation / VIN / référence facultative et véhicule de la
--             page d'achat, enregistrés avec la commande (ord_vehicle_check)
-- Date      : 2026-11-17 (mandat BN, département 13)
-- Scope     : public.___xtr_order (1 colonne jsonb nullable, sans défaut) et
--             public.create_order_atomic (écrit cette colonne). Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI : le tunnel affichait « Compatibilité vérifiée » sans vérification.
-- Le client peut désormais laisser une immatriculation, un VIN ou une référence
-- de pièce (facultatif) ; avec le véhicule de la page d'achat, l'équipe vérifie
-- la compatibilité avant l'envoi. Aucune colonne existante ne porte cette
-- donnée (ord_link / ord_link_type : legacy, sens différent, non réutilisés).
--
-- FORME (version 1, écrite par OrdersService.createOrder via
-- backend/src/modules/orders/services/order-vehicle-check.ts, validée côté
-- serveur) :
--   { "version": 1, "customer_reference": text|null,
--     "purchase_vehicle": { "type_id", "brand", "model", "engine",
--                           "source": "vehicle_context" }|null,
--     "line_type_ids": [int], "captured_at": iso8601 }
-- NULL = rien fourni (commandes antérieures comprises).
--
-- COMPATIBILITÉ DE DÉPLOIEMENT : le backend envoie déjà la clé
-- p_order.ord_vehicle_check ; l'ancien corps l'ignore (liste de colonnes
-- explicite). L'ordre code → migration est donc sans risque ; migration →
-- ancien code aussi (la clé est absente, la colonne reste NULL).
--
-- CORPS DE create_order_atomic : celui de 20260523_002_cancel_order_atomic.sql
-- (md5(prosrc) 6c0d8e09318f059651920b8a2a214644, mesuré en base le 2026-10-01 par
-- 20261001_pin_order_functions_search_path.sql), plus une colonne dans
-- l'INSERT de l'en-tête. Lignes, événement ORDER_CREATED, signature, valeur de
-- retour : inchangés. CREATE OR REPLACE conserve le propriétaire ; les droits
-- EXECUTE (postgres, service_role) sont redéclarés après le corps ; SECURITY DEFINER et
-- search_path = public, pg_temp sont redéclarés à l'identique.
-- NULLIF(… , 'null'::jsonb) : un JSON null envoyé par le backend devient un
-- NULL SQL.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », essai à blanc puis réel), après fusion sur
-- main, par l'owner. Jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20261117_order_vehicle_check.down.sql, à lancer à la main (le
-- moteur est forward-only). Il remet le corps précédent et retire la colonne.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`).
-- ADD COLUMN nullable sans défaut = changement de catalogue seul (pas de
-- réécriture de table) ; le verrou ACCESS EXCLUSIVE est bref, borné ici.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- §0 — PRÉ-CONDITION FAIL-CLOSED : corps mesuré (premier passage) ou corps
-- cible (rejeu), SECURITY DEFINER, propriétaire postgres, search_path épinglé.
DO $precheck$
DECLARE
  v_oid    oid := to_regprocedure('public.create_order_atomic(jsonb, jsonb, uuid)');
  v_n      int;
  v_secdef boolean;
  v_owner  text;
  v_md5    text;
  v_config text[];
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'ABORT: create_order_atomic(jsonb, jsonb, uuid) introuvable';
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_order_atomic';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % surcharges de create_order_atomic, 1 attendue', v_n;
  END IF;
  SELECT p.prosecdef, pg_get_userbyid(p.proowner), md5(p.prosrc), p.proconfig
    INTO v_secdef, v_owner, v_md5, v_config
    FROM pg_proc p WHERE p.oid = v_oid;
  IF NOT v_secdef OR v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'ABORT: prosecdef=% owner=% (attendu true / postgres)', v_secdef, v_owner;
  END IF;
  IF v_md5 NOT IN ('6c0d8e09318f059651920b8a2a214644', 'bc8867193b01d970eaef165f919dff7c') THEN
    RAISE EXCEPTION 'ABORT: corps de create_order_atomic inattendu (ni le corps mesuré ni le corps cible, md5 %)', v_md5;
  END IF;
  IF v_config IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
    RAISE EXCEPTION 'ABORT: proconfig inattendu : %', v_config;
  END IF;
END
$precheck$;

-- §1 — COLONNE
ALTER TABLE public."___xtr_order"
  ADD COLUMN IF NOT EXISTS ord_vehicle_check jsonb;

COMMENT ON COLUMN public."___xtr_order".ord_vehicle_check IS
  'Mandat BN (2026-11-17) : immatriculation/VIN/référence facultative saisie au tunnel + véhicule de la page d''achat, pour vérification de compatibilité avant envoi. Forme version 1, écrite par create_order_atomic depuis OrdersService.createOrder. NULL = rien fourni.';

-- §2 — create_order_atomic écrit la colonne
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order          JSONB,
  p_lines          JSONB,
  p_correlation_id UUID DEFAULT gen_random_uuid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ord_id  TEXT;
  v_line    JSONB;
  v_payload JSONB;
BEGIN
  -- Extract order ID
  v_ord_id := p_order->>'ord_id';

  IF v_ord_id IS NULL OR v_ord_id = '' THEN
    RAISE EXCEPTION 'ord_id is required';
  END IF;

  -- INSERT order (single transaction — auto-rollback on any error)
  INSERT INTO "___xtr_order" (
    ord_id, ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay,
    ord_amount_ttc, ord_deposit_ttc, ord_shipping_fee_ttc, ord_total_ttc,
    ord_info, ord_ords_id, ord_cba_id, ord_cda_id,
    ord_billing_snapshot, ord_shipping_snapshot, ord_vehicle_check
  ) VALUES (
    v_ord_id,
    p_order->>'ord_cst_id',
    p_order->>'ord_date',
    COALESCE(p_order->>'ord_parent', '0'),
    COALESCE(p_order->>'ord_is_pay', '0'),
    NULLIF(p_order->>'ord_date_pay', ''),
    p_order->>'ord_amount_ttc',
    p_order->>'ord_deposit_ttc',
    p_order->>'ord_shipping_fee_ttc',
    p_order->>'ord_total_ttc',
    p_order->>'ord_info',
    COALESCE(p_order->>'ord_ords_id', '1'),
    NULLIF(p_order->>'ord_cba_id', ''),
    NULLIF(p_order->>'ord_cda_id', ''),
    (p_order->'ord_billing_snapshot')::jsonb,
    (p_order->'ord_shipping_snapshot')::jsonb,
    NULLIF(p_order->'ord_vehicle_check', 'null'::jsonb)
  );

  -- INSERT order lines (loop preserves PR #695 / F1 attribution support)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO "___xtr_order_line" (
      orl_id, orl_ord_id, orl_pg_id, orl_pg_name, orl_pm_name, orl_art_ref,
      orl_art_quantity, orl_art_price_sell_unit_ttc, orl_art_price_sell_ttc,
      orl_art_deposit_unit_ttc, orl_art_deposit_ttc, orl_website_url
    ) VALUES (
      v_line->>'orl_id',
      v_ord_id,
      v_line->>'orl_pg_id',
      v_line->>'orl_pg_name',
      v_line->>'orl_pm_name',
      v_line->>'orl_art_ref',
      v_line->>'orl_art_quantity',
      v_line->>'orl_art_price_sell_unit_ttc',
      v_line->>'orl_art_price_sell_ttc',
      v_line->>'orl_art_deposit_unit_ttc',
      v_line->>'orl_art_deposit_ttc',
      v_line->>'orl_website_url'
    );
  END LOOP;

  -- ATOMIC audit: append ORDER_CREATED event in same transaction.
  -- from_status = NULL (creation has no prior state) ; to_status = '1' (PROCESSING canon initial).
  v_payload := jsonb_build_object(
    'lines_count', jsonb_array_length(p_lines),
    'total_ttc',   p_order->>'ord_total_ttc',
    'customer_id', p_order->>'ord_cst_id'
  );

  PERFORM public.append_order_event(
    v_ord_id, 'ORDER_CREATED', NULL, COALESCE(p_order->>'ord_ords_id', '1'),
    v_payload, 'orders_service',
    p_correlation_id, NULL
  );

  RETURN v_ord_id;
END;
$function$;

COMMENT ON FUNCTION public.create_order_atomic(JSONB, JSONB, UUID) IS
  'Composite RPC extended from PR #695: INSERT ___xtr_order + ___xtr_order_line + append ORDER_CREATED event, all in same transaction. p_correlation_id is optional (DEFAULT gen_random_uuid()) for back-compat. Writes ord_vehicle_check (mandat BN, 2026-11-17). Owner: OrdersService.createOrder per authority-graph.yaml#rpc_authority.rpcs.create_order_atomic.';

-- Droits EXECUTE redéclarés explicitement (check-definer-anon-surface) :
-- identiques à l'état mesuré le 2026-11-17 (postgres propriétaire,
-- service_role) ; jamais PUBLIC, anon ni authenticated, même en rejeu.
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB, UUID) TO service_role;

-- §3 — POST-CONDITION FAIL-CLOSED : corps cible exact, colonne présente.
DO $postcheck$
DECLARE
  v_oid    oid := to_regprocedure('public.create_order_atomic(jsonb, jsonb, uuid)');
  v_n      int;
  v_secdef boolean;
  v_owner  text;
  v_md5    text;
  v_config text[];
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'ABORT: create_order_atomic(jsonb, jsonb, uuid) introuvable';
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_order_atomic';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % surcharges de create_order_atomic, 1 attendue', v_n;
  END IF;
  SELECT p.prosecdef, pg_get_userbyid(p.proowner), md5(p.prosrc), p.proconfig
    INTO v_secdef, v_owner, v_md5, v_config
    FROM pg_proc p WHERE p.oid = v_oid;
  IF NOT v_secdef OR v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'ABORT: prosecdef=% owner=% (attendu true / postgres)', v_secdef, v_owner;
  END IF;
  IF v_md5 NOT IN ('bc8867193b01d970eaef165f919dff7c') THEN
    RAISE EXCEPTION 'ABORT: corps de create_order_atomic inattendu (corps cible attendu, md5 %)', v_md5;
  END IF;
  IF v_config IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
    RAISE EXCEPTION 'ABORT: proconfig inattendu : %', v_config;
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus sur create_order_atomic';
  END IF;
END
$postcheck$;

DO $colcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '___xtr_order'
       AND column_name = 'ord_vehicle_check' AND data_type = 'jsonb'
       AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'ABORT: colonne ord_vehicle_check absente ou de forme inattendue';
  END IF;
END
$colcheck$;
