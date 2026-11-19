-- =============================================================================
-- Migration : statut de commande 3 → « Payée, à traiter » ; nouveaux statuts
--             7 « Expédiée » et 8 « Livrée »
-- Date      : 2026-11-17 (mandat BN, département 13)
-- Scope     : public.___xtr_order_status uniquement :
--             - ligne ords_id = '3', colonne ords_named ;
--             - deux lignes nouvelles, ords_id = '7' et '8'.
--             Les lignes 1, 2, 4 et 5 ne sont pas touchées.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI : décision de Marwane du 17/11/2026 à 22:01 (point n° 4) :
--   « Ne touche pas aux libellés 1, 2, 4 et 5 : ils décrivent l'historique.
--     Le 3 devient "Payée, à traiter". Ajoute deux statuts nouveaux,
--     "Expédiée" et "Livrée", et les boutons du site écrivent ces nouveaux
--     statuts. Le passage chez le fournisseur reste suivi ligne par ligne. »
-- Remplace la version précédente de ce fichier (« Payée, en préparation »),
-- jamais appliquée.
--
-- CHOIX DES IDENTIFIANTS (lecture seule, 2026-11-17) :
--   - la table contient 1 à 5 ;
--   - '6' est ABSENT de la table mais porté par 6 commandes (6 payées, toutes
--     avec ord_cancel_date) : l'ancienne annulation admin l'écrivait
--     (command-center-kpi.service.ts, ADMIN_CANCELLED_STATUS). Il n'est donc
--     PAS libre et n'est pas repris ici ;
--   - aucune commande ni aucun historique (___xtr_order_history) ne porte '7'
--     ou '8' : ce sont les premiers identifiants libres.
--
-- BRANCHEMENT : les boutons « expédier » et « livrer » écrivent aujourd'hui 4
-- et 5 (order-actions.service.ts). Leur passage sur 7 et 8 est fait par la
-- session BM, pas par cette migration. Appliquer cette migration avant ce
-- branchement ne change aucune commande.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », essai à blanc puis réel), après fusion sur
-- main, par l'owner.
--
-- ROLLBACK : 20261117_order_status_3_label.down.sql, à lancer à la main.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- §0 — PRÉ-CONDITIONS FAIL-CLOSED.
DO $precheck$
DECLARE
  v_named text;
  v_n     int;
BEGIN
  -- La ligne 3 existe et porte l'ancien libellé (premier passage), le libellé
  -- de la version précédente de ce fichier ou le nouveau (rejeu).
  SELECT count(*), max(ords_named) INTO v_n, v_named
    FROM public."___xtr_order_status" WHERE ords_id = '3';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'precheck: % ligne(s) ords_id=3 (attendu 1)', v_n;
  END IF;
  IF v_named NOT IN ('En attente de rajout de frais de port',
                     'Payée, en préparation',
                     'Payée, à traiter') THEN
    RAISE EXCEPTION 'precheck: libellé inattendu pour ords_id=3 : %', v_named;
  END IF;

  -- 7 et 8 sont absents, ou déjà présents avec exactement ce libellé (rejeu).
  SELECT count(*) INTO v_n
    FROM public."___xtr_order_status"
   WHERE (ords_id = '7' AND ords_named IS DISTINCT FROM 'Expédiée')
      OR (ords_id = '8' AND ords_named IS DISTINCT FROM 'Livrée');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'precheck: ords_id 7 ou 8 déjà pris par un autre libellé';
  END IF;

  -- Aucune commande ne porte déjà 7 ou 8 sans que la ligne existe : sinon ces
  -- identifiants auraient un sens hérité inconnu.
  SELECT count(*) INTO v_n
    FROM public."___xtr_order" o
   WHERE o.ord_ords_id IN ('7', '8')
     AND NOT EXISTS (SELECT 1 FROM public."___xtr_order_status" s
                      WHERE s.ords_id = o.ord_ords_id);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'precheck: % commande(s) portent déjà 7 ou 8 sans libellé', v_n;
  END IF;
END
$precheck$;

-- §1 — Libellé du statut 3 (1 ligne au plus).
UPDATE public."___xtr_order_status"
   SET ords_named = 'Payée, à traiter'
 WHERE ords_id = '3'
   AND ords_named IN ('En attente de rajout de frais de port',
                      'Payée, en préparation');

-- §2 — Statuts nouveaux. Rejeu sans effet grâce à ON CONFLICT.
INSERT INTO public."___xtr_order_status"
  (ords_id, ords_named, ords_action, ords_color, ords_dept_id)
VALUES
  ('7', 'Expédiée', 'Expédition de la commande', '3b82f6', '1'),
  ('8', 'Livrée',   'Livraison confirmée',       '15803d', '1')
ON CONFLICT (ords_id) DO NOTHING;

-- §3 — POST-CONDITIONS.
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."___xtr_order_status"
     WHERE ords_id = '3' AND ords_named = 'Payée, à traiter'
  ) THEN
    RAISE EXCEPTION 'postcheck: libellé du statut 3 non appliqué';
  END IF;
  IF (SELECT count(*) FROM public."___xtr_order_status"
       WHERE (ords_id = '7' AND ords_named = 'Expédiée')
          OR (ords_id = '8' AND ords_named = 'Livrée')) <> 2 THEN
    RAISE EXCEPTION 'postcheck: statuts 7 et 8 absents';
  END IF;
  IF (SELECT count(*) FROM public."___xtr_order_status"
       WHERE ords_id IN ('1', '2', '4', '5')) <> 4 THEN
    RAISE EXCEPTION 'postcheck: lignes 1, 2, 4, 5 incomplètes';
  END IF;
END
$postcheck$;
