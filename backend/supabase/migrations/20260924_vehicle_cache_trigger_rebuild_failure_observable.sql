-- Migration : rendre OBSERVABLE l'échec de reconstruction du cache R8 dans
-- trg_auto_type_rebuild_cache().
--
-- PROBLÈME (lu en lecture seule sur la base live le 2026-09-24) :
--   Le trigger AFTER INSERT OR UPDATE OF type_display ON public.auto_type
--   appelle public.rebuild_vehicle_page_cache(type_id) quand un type devient
--   affichable (INSERT avec type_display = 1, ou UPDATE 0 -> 1). Le corps live
--   (20260425, search_path épinglé par 20260616_vague5) :
--     BEGIN
--       PERFORM public.rebuild_vehicle_page_cache(v_type_id_int);
--     EXCEPTION WHEN OTHERS THEN
--       RAISE WARNING 'INC-2026-007: rebuild_vehicle_page_cache(%) failed in trigger: %', ...;
--     END;
--   Deux échecs y disparaissent sans trace durable :
--     1. une EXCEPTION du rebuild : réduite à un WARNING dans le journal
--        PostgreSQL, que rien ne collecte ;
--     2. un retour FALSE du rebuild (build_vehicle_page_payload renvoie NULL :
--        le type ne rejoint pas auto_modele / auto_marque par ses INNER JOIN) :
--        rebuild_vehicle_page_cache SUPPRIME alors la ligne de cache et renvoie
--        FALSE, que PERFORM jette — pas même un WARNING.
--   Dans les deux cas le type est affichable et __vehicle_page_cache n'a pas de
--   ligne pour lui. refresh_stale_vehicle_cache() ne parcourt que les lignes
--   EXISTANTES marquées stale : une ligne ABSENTE n'est jamais rattrapée. Seule
--   la lecture get_vehicle_page_data_cached() reconstruit à la demande — c'est
--   le rebuild synchrone sur miss que INC-2026-007 a voulu éliminer.
--
-- CAUSE RACINE — un repli gouverné mais NON observable :
--   Le repli est un choix explicite de 20260425 (« Best-effort : si rebuild
--   échoue (vehicle pas trouvé, etc.), ne pas bloquer le INSERT »). CLAUDE.md,
--   invariant 3 : « tout repli INTERDIT sauf explicitement gouverné ET
--   observable ». Gouverné : oui. Observable : non. C'est cette moitié qui
--   manque, et c'est elle qu'on ajoute — même diagnostic que 20260916.
--
-- DÉCISION — non-bloquant + échec enregistré, et REFUS si l'enregistrement
-- lui-même échoue (preuves dans la PR) :
--   - Qui émet ces UPDATE : personne dans le code. backend/src n'écrit jamais
--     auto_type (0 appel update/insert/upsert sur la table), aucune fonction
--     live n'écrit auto_type (pg_proc : 0 corps contenant « update auto_type »
--     ou « insert into auto_type »), aucun script ne pose type_display = 1
--     (scripts/tecdoc-pipeline/create-vehicles-p4a.py insère type_display = '0',
--     « validation manuelle avant activation »). L'activation est une opération
--     SQL manuelle ou en masse d'un opérateur. pg_stat_user_tables(auto_type) :
--     n_tup_ins = 0, n_tup_upd = 0 depuis le re-provisionnement du 2026-09-17.
--   - Propager l'erreur ferait échouer TOUTE une activation en masse (le trigger
--     est FOR EACH ROW dans l'instruction de l'opérateur) pour UN type dont la
--     projection dérivée ne se construit pas, et couplerait la source de vérité
--     (auto_type) à sa projection (__vehicle_page_cache). Le choix non-bloquant
--     de 20260425 reste juste ; il lui manque d'être vu.
--   - L'échec est donc ÉCRIT dans le puits existant, dans la même transaction
--     que l'activation : si l'opérateur annule, l'événement disparaît avec elle.
--   - Si l'écriture de l'événement échoue à son tour, le trigger LÈVE une
--     exception qui porte les deux messages : l'activation est refusée plutôt
--     que de laisser un type affichable sans cache ET sans trace. Il n'existe
--     plus aucun chemin où l'échec reste muet.
--
-- CHANGEMENT (un seul objet touché : le corps de la fonction trigger) :
--   - échec (exception ou FALSE) : WARNING conservé, puis un événement
--     anomaly_detected / alert_kind = 'vehicle_page_cache_trigger_rebuild_failed'
--     par type_id, dédupliqué sur les événements OUVERTS de moins de 7 jours ;
--   - succès : la fonction REFERME ses propres événements ouverts pour ce
--     type_id (resolved_at + resolution_kind), doctrine
--     OPEN -> STILL_OPEN -> RESOLVED de 20260626.
--
-- CE QUI N'EST PAS TOUCHÉ (délibérément) :
--   - La condition de déclenchement, bit pour bit : seules les transitions
--     INSERT = 1 et UPDATE 0 -> 1 reconstruisent. Les passages 2/3/4/9 -> 1 ne
--     reconstruisent pas aujourd'hui ; c'est signalé dans la PR, pas corrigé ici.
--   - Le trigger lui-même (AFTER INSERT OR UPDATE OF type_display, FOR EACH
--     ROW) : aucun DROP / CREATE TRIGGER, aucun verrou sur auto_type.
--   - rebuild_vehicle_page_cache, build_vehicle_page_payload,
--     get_vehicle_page_data_cached, refresh_stale_vehicle_cache : inchangées.
--   - Le cast NEW.type_id::INTEGER reste hors du bloc protégé, comme avant.
--   - Aucune table, colonne, valeur d'enum, index ni job pg_cron créé.
--
-- TAXONOMIE — miroir de 20260601 (detect_cwv_aggregation_coverage_gap) et de
--   20260916 (detect_cwv_trend_divergence) : enum existant
--   seo_event_type = 'anomaly_detected' + discriminant payload.alert_kind,
--   sévérité 'high', dédup sur événements OUVERTS de moins de 7 jours. AUCUN
--   ALTER TYPE ADD VALUE -> migration 100 % réversible. `reason`, `source` et
--   `count` sont dans la charge utile parce que rpc_seo_alerts_v1 (source B :
--   non résolus, critical|high, anomaly_detected) ne projette que ces trois
--   champs. 'high' parce que l'effet est le même dans les deux cas : un type
--   affichable dont la page R8 n'a pas de ligne de cache (et, si le payload
--   est NULL, répond « Vehicle not found »). entity_url reste NULL : aucune
--   URL n'est reconstruite ici (jamais d'URL inventée) ; type_id suffit.
--
-- COÛT : sur le chemin nominal, une seule requête de plus par type activé
--   (UPDATE d'auto-résolution, filtré par event_type — 1 seul événement
--   anomaly_detected en base le 2026-09-24 — et par payload @>, index GIN
--   idx_seo_event_log_payload_gin), à comparer au rebuild lui-même (125 ms à
--   chaud, jusqu'à 4 s à froid selon scripts/seo/backfill-vehicle-page-cache.ts).
--
-- VERROUS : CREATE OR REPLACE FUNCTION ne modifie que le catalogue : aucun
--   verrou de table, aucune réécriture. lock_timeout court : en cas d'attente,
--   l'application échoue proprement au lieu de bloquer.
--
-- DROITS : inchangés (REVOKE PUBLIC/anon/authenticated, GRANT service_role),
--   ré-affirmés car CREATE OR REPLACE conserve l'ACL mais la ré-affirmation rend
--   la migration autoportante sur une base neuve. SECURITY DEFINER conservé : la
--   fonction appartient à postgres, propriétaire de __seo_event_log. search_path
--   vide + noms qualifiés, comme 20260911 / 20260916.
--
-- ROLLBACK : 20260924_vehicle_cache_trigger_rebuild_failure_observable.down.sql
--   (restaure verbatim le corps live du 2026-09-24).
--
-- Test de comportement (PostgreSQL 17 jetable, sans réseau) :
--   bash scripts/db/test-vehicle-cache-trigger-observable.sh
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe le fichier dans une
-- transaction (squawk: assume_in_transaction).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.trg_auto_type_rebuild_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type_id_int INTEGER;
  v_built       BOOLEAN;
  v_outcome     TEXT;
  v_sqlstate    TEXT;
  v_error       TEXT;
BEGIN
  v_type_id_int := NEW.type_id::INTEGER;

  IF (TG_OP = 'INSERT' AND NEW.type_display::INT = 1)
     OR (TG_OP = 'UPDATE' AND COALESCE(OLD.type_display, '0')::INT = 0 AND NEW.type_display::INT = 1)
  THEN
    BEGIN
      v_built := public.rebuild_vehicle_page_cache(v_type_id_int);
      IF v_built IS NOT TRUE THEN
        -- rebuild_vehicle_page_cache a supprimé la ligne et renvoyé FALSE :
        -- build_vehicle_page_payload n'a rien trouvé à joindre.
        v_outcome := 'payload_null';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_outcome := 'exception';
      GET STACKED DIAGNOSTICS
        v_sqlstate = RETURNED_SQLSTATE,
        v_error    = MESSAGE_TEXT;
    END;

    IF v_outcome IS NULL THEN
      -- Succès : refermer les événements ouverts de CE type (auto-résolution).
      UPDATE public.__seo_event_log
         SET resolved_at = now(),
             payload = payload || jsonb_build_object(
               'resolution_kind', 'trigger_rebuild_succeeded',
               'resolved_by', 'trg_auto_type_rebuild_cache'
             )
       WHERE event_type = 'anomaly_detected'::public.seo_event_type
         AND resolved_at IS NULL
         AND payload @> jsonb_build_object(
               'alert_kind', 'vehicle_page_cache_trigger_rebuild_failed',
               'type_id', v_type_id_int
             );
    ELSE
      RAISE WARNING 'INC-2026-007: rebuild_vehicle_page_cache(%) failed in trigger (%): %',
        v_type_id_int, v_outcome, COALESCE(v_error, 'payload NULL');

      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM public.__seo_event_log e
           WHERE e.event_type = 'anomaly_detected'::public.seo_event_type
             AND e.resolved_at IS NULL
             AND e.created_at >= now() - INTERVAL '7 days'
             AND e.payload @> jsonb_build_object(
                   'alert_kind', 'vehicle_page_cache_trigger_rebuild_failed',
                   'type_id', v_type_id_int
                 )
        ) THEN
          INSERT INTO public.__seo_event_log (event_type, entity_url, severity, payload)
          VALUES (
            'anomaly_detected'::public.seo_event_type,
            NULL,
            'high'::public.seo_severity,
            jsonb_build_object(
              'alert_kind', 'vehicle_page_cache_trigger_rebuild_failed',
              'reason', format(
                'Type %s rendu affichable (%s) sans ligne dans __vehicle_page_cache : rebuild_vehicle_page_cache en échec (%s : %s).',
                v_type_id_int, TG_OP, v_outcome, COALESCE(v_error, 'payload NULL')
              ),
              'source', 'trg_auto_type_rebuild_cache',
              'count', 1,
              'type_id', v_type_id_int,
              'tg_op', TG_OP,
              'outcome', v_outcome,
              'sqlstate', v_sqlstate,
              'error', v_error,
              'old_type_display', CASE WHEN TG_OP = 'UPDATE' THEN OLD.type_display END,
              'new_type_display', NEW.type_display,
              'hint', format(
                'Vérifier : SELECT type_id, stale, built_at FROM public.__vehicle_page_cache WHERE type_id = %s. '
                'payload_null = auto_type ne rejoint pas auto_modele / auto_marque (INNER JOIN de build_vehicle_page_payload) : corriger la donnée d''abord. '
                'Reconstruire : SELECT public.rebuild_vehicle_page_cache(%s) (ou scripts/seo/backfill-vehicle-page-cache.ts --type-ids=%s). '
                'refresh_stale_vehicle_cache ne rattrape jamais une ligne absente. '
                'Un rebuild hors trigger ne referme pas cet événement : poser resolved_at à la main une fois la ligne présente.',
                v_type_id_int, v_type_id_int, v_type_id_int
              )
            )
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'trg_auto_type_rebuild_cache: échec de rebuild du type % (% : %) NON enregistrable dans __seo_event_log (%) — activation refusée, pas de repli silencieux',
          v_type_id_int, v_outcome, COALESCE(v_error, 'payload NULL'), SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_auto_type_rebuild_cache() IS
  'INC-2026-007 Etape 3 : pre-rebuild __vehicle_page_cache des qu''un type est insere ou active (INSERT type_display=1, UPDATE 0->1). Non bloquant : un echec (exception ou payload NULL) est ecrit dans __seo_event_log (anomaly_detected, alert_kind=vehicle_page_cache_trigger_rebuild_failed, high, dedup 7 j sur ouverts) et referme au rebuild reussi suivant ; si cette ecriture echoue, l''activation est refusee (20260924).';

REVOKE EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() TO service_role;
