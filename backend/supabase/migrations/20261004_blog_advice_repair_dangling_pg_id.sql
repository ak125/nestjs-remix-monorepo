-- =============================================================================
-- Migration : rattacher à leur gamme les 12 conseils dont ba_pg_id ne désigne
--             aucune gamme
-- Date      : 2026-10-04
-- Scope     : public.__blog_advice — 12 lignes, colonne ba_pg_id UNIQUEMENT,
--             ancien identifiant (absent de pieces_gamme) → pg_id de la gamme
--             que le conseil nomme déjà dans ba_primary_gamme_slug.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — rapport GSC « Introuvable (404) », tri du 2026-10-03 :
--   * la page conseils est indexée sur le pg_alias de la gamme
--     (/blog-pieces-auto/conseils/{pg_alias}) ; l'API article ne renseigne
--     pg_alias que si ba_pg_id désigne une ligne de pieces_gamme
--     (blog-article-data.service.ts) ;
--   * 12 conseils portent un ba_pg_id absent de pieces_gamme. Résultat mesuré
--     en PROD : /conseils/{gamme} répond 404 pour ces 12 gammes, et l'article
--     reste servi sur /blog-pieces-auto/article/{ba_alias} en « index, follow »
--     avec une canonical sur lui-même, hors de l'adresse canonique des
--     conseils. Exemple : /blog-pieces-auto/conseils/leve-vitre → 404.
--
-- POURQUOI CES VALEURS (aucune gamme choisie ni URL inventée) :
--   * la cible est la gamme que le conseil nomme lui-même :
--     ba_primary_gamme_slug = pg_alias. Son pg_id est celui que publie le
--     sitemap catalogue (/pieces/{pg_alias}-{pg_id}.html, relevé le
--     2026-10-03), et la pré-condition ci-dessous le revérifie en base :
--     exactement une ligne pieces_gamme porte cet alias, avec cet identifiant ;
--   * aucun autre conseil n'est déjà rattaché à ces 12 gammes (vérifié
--     ci-dessous) : la page conseils de la gamme ne change pas de conseil.
--
-- EFFETS CONNUS (à l'expiration des caches Redis et Cloudflare) :
--   * /blog-pieces-auto/conseils/{gamme} : 404 → 200 pour les 12 gammes ;
--   * /blog-pieces-auto/article/{ba_alias} : 200 → 301 vers
--     /blog-pieces-auto/conseils/{gamme} (règle existante de la route article) ;
--   * get_r6_guide_link_snapshot().conseils_aliases gagne ces 12 alias :
--     la politique R6 (ADR-103) traite leurs guides d'achat comme les autres
--     gammes dotées d'un conseil ;
--   * la page gamme R1 affiche le bloc « guide d'achat » du conseil, lié à
--     /blog-pieces-auto/conseils/{gamme}.
--
-- HORS LOT, VOLONTAIREMENT : toutes les autres colonnes (ba_primary_gamme_slug
-- est déjà juste), __sitemap_blog, contenus servis.
--
-- IDEMPOTENT ET REJOUABLE : chaque ligne est acceptée avec l'ancien
-- identifiant (état mesuré) ou déjà avec le nouveau (rejeu) ; toute autre
-- valeur interrompt la migration. L'UPDATE ne touche que les lignes encore sur
-- l'ancien identifiant.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20261004_blog_advice_repair_dangling_pg_id.down.sql (remet
-- l'ancien identifiant sur les seules lignes encore égales au nouveau), à
-- lancer à la main : le moteur est forward-only.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). L'UPDATE prend des
-- verrous de ligne sur 12 lignes, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- Pré-conditions, écriture et post-conditions dans un seul bloc : la liste
-- n'existe qu'une fois, et tout écart l'interrompt avant ou après l'UPDATE.
DO $repair$
DECLARE
  c_rows CONSTANT jsonb := $json$
    [{"ba_id":"3","slug":"changer-un-turbocompresseur","old":"1583","new":2234,"gamme":"turbo"}
    ,{"ba_id":"10","slug":"comment-changer-un-debitmetre-d-air","old":"1804","new":3927,"gamme":"debitmetre-d-air"}
    ,{"ba_id":"25","slug":"comment-changer-une-sonde-lambda","old":"1803","new":3922,"gamme":"sonde-lambda"}
    ,{"ba_id":"29","slug":"comment-changer-une-rotule-direction","old":"1576","new":2066,"gamme":"rotule-de-direction"}
    ,{"ba_id":"35","slug":"comment-changer-vos-injecteurs","old":"1783","new":3902,"gamme":"injecteur"}
    ,{"ba_id":"50","slug":"comment-changer-un-kit-frein-arriere","old":"1683","new":3859,"gamme":"kit-de-freins-arriere"}
    ,{"ba_id":"65","slug":"comment-changer-une-poulie-vilebrequin","old":"1623","new":3213,"gamme":"poulie-vilebrequin"}
    ,{"ba_id":"67","slug":"comment-changer-un-boitier-prechauffage","old":"1557","new":1750,"gamme":"boitier-de-prechauffage"}
    ,{"ba_id":"71","slug":"comment-changer-une-rotule-suspension","old":"1592","new":2462,"gamme":"rotule-de-suspension"}
    ,{"ba_id":"80","slug":"comment-changer-une-bague-d-etancheite-moteur","old":"1695","new":3874,"gamme":"bagues-d-etancheite-moteur"}
    ,{"ba_id":"87","slug":"comment-changer-un-pulseur-d-air-d-habitacle","old":"1612","new":2669,"gamme":"pulseur-d-air-d-habitacle"}
    ,{"ba_id":"101","slug":"comment-changer-un-leve-vitre","old":"1536","new":1561,"gamme":"leve-vitre"}
    ]
  $json$::jsonb;
  r         record;
  v_n       bigint;
  v_pending bigint;
  v_updated bigint;
BEGIN
  -- §0 — PRÉ-CONDITIONS FAIL-CLOSED
  SELECT count(*) INTO v_n
    FROM (SELECT DISTINCT e.ba_id
            FROM jsonb_to_recordset(c_rows)
              AS e(ba_id text, slug text, old text, new integer, gamme text)) d;
  IF v_n <> 12 OR jsonb_array_length(c_rows) <> 12 THEN
    RAISE EXCEPTION 'ABORT: liste — 12 ba_id distincts attendus, % distincts / % lignes',
      v_n, jsonb_array_length(c_rows);
  END IF;

  FOR r IN
    SELECT e.ba_id, e.slug, e.old, e.new, e.gamme,
           ba.ba_id AS found_id, ba.ba_alias, ba.ba_pg_id, ba.ba_primary_gamme_slug
      FROM jsonb_to_recordset(c_rows)
        AS e(ba_id text, slug text, old text, new integer, gamme text)
      LEFT JOIN public.__blog_advice ba ON ba.ba_id = e.ba_id
  LOOP
    IF r.found_id IS NULL THEN
      RAISE EXCEPTION 'ABORT: ba_id % introuvable', r.ba_id;
    END IF;
    IF r.ba_alias IS DISTINCT FROM r.slug THEN
      RAISE EXCEPTION 'ABORT: ba_id % — ba_alias « % » attendu, « % » trouvé', r.ba_id, r.slug, r.ba_alias;
    END IF;
    IF r.ba_primary_gamme_slug IS DISTINCT FROM r.gamme THEN
      RAISE EXCEPTION 'ABORT: ba_id % — ba_primary_gamme_slug « % » attendu, « % » trouvé',
        r.ba_id, r.gamme, r.ba_primary_gamme_slug;
    END IF;
    IF r.ba_pg_id IS NULL OR r.ba_pg_id NOT IN (r.old, r.new::text) THEN
      RAISE EXCEPTION 'ABORT: ba_id % — ba_pg_id « % » ni % ni %', r.ba_id, r.ba_pg_id, r.old, r.new;
    END IF;
    -- L'ancien identifiant ne doit désigner aucune gamme : sinon le conseil
    -- n'est pas orphelin et le rattacher ailleurs serait un choix éditorial.
    IF EXISTS (SELECT 1 FROM public.pieces_gamme pg WHERE pg.pg_id::text = r.old) THEN
      RAISE EXCEPTION 'ABORT: ba_id % — l''ancien pg_id % existe dans pieces_gamme', r.ba_id, r.old;
    END IF;
    SELECT count(*) INTO v_n FROM public.pieces_gamme pg WHERE pg.pg_alias = r.gamme;
    IF v_n <> 1 OR NOT EXISTS (
      SELECT 1 FROM public.pieces_gamme pg WHERE pg.pg_alias = r.gamme AND pg.pg_id = r.new
    ) THEN
      RAISE EXCEPTION 'ABORT: ba_id % — pg_alias « % » : % ligne(s), pg_id % attendu seul',
        r.ba_id, r.gamme, v_n, r.new;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.__blog_advice o
       WHERE o.ba_pg_id = r.new::text AND o.ba_id <> r.ba_id
    ) THEN
      RAISE EXCEPTION 'ABORT: ba_id % — un autre conseil est déjà rattaché au pg_id %', r.ba_id, r.new;
    END IF;
  END LOOP;

  -- Mesure du 2026-10-03 : ces 12 conseils sont les seuls orphelins. Un
  -- orphelin hors liste invalide la mesure : on s'arrête plutôt que de livrer
  -- une réparation partielle présentée comme complète.
  SELECT count(*) INTO v_n
    FROM public.__blog_advice ba
   WHERE ba.ba_pg_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.pieces_gamme pg WHERE pg.pg_id::text = ba.ba_pg_id)
     AND ba.ba_id NOT IN (SELECT e.ba_id FROM jsonb_to_recordset(c_rows) AS e(ba_id text));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % conseil(s) orphelin(s) hors de la liste mesurée', v_n;
  END IF;

  SELECT count(*) INTO v_pending
    FROM jsonb_to_recordset(c_rows) AS e(ba_id text, old text)
    JOIN public.__blog_advice ba ON ba.ba_id = e.ba_id AND ba.ba_pg_id = e.old;

  -- §1 — ÉCRITURE (lignes encore sur l'ancien identifiant uniquement)
  -- Nom non qualifié (search_path épinglé ci-dessus) : c'est la forme que
  -- reconnaît le ratchet des écritures de contenu servi
  -- (scripts/audit/check-served-content-write-sinks-ratchet.ts).
  UPDATE __blog_advice ba
     SET ba_pg_id = e.new::text
    FROM jsonb_to_recordset(c_rows)
      AS e(ba_id text, slug text, old text, new integer, gamme text)
   WHERE ba.ba_id = e.ba_id
     AND ba.ba_pg_id = e.old;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- §2 — POST-CONDITIONS
  IF v_updated <> v_pending THEN
    RAISE EXCEPTION 'ABORT: post-condition — % lignes écrites, % attendues', v_updated, v_pending;
  END IF;

  SELECT count(*) INTO v_n
    FROM jsonb_to_recordset(c_rows) AS e(ba_id text, new integer, gamme text)
    JOIN public.__blog_advice ba ON ba.ba_id = e.ba_id AND ba.ba_pg_id = e.new::text
    JOIN public.pieces_gamme pg ON pg.pg_id = e.new AND pg.pg_alias = e.gamme;
  IF v_n <> 12 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 12 conseils rattachés à leur gamme', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.__blog_advice ba
   WHERE ba.ba_pg_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.pieces_gamme pg WHERE pg.pg_id::text = ba.ba_pg_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % conseil(s) encore orphelin(s)', v_n;
  END IF;

  RAISE NOTICE '__blog_advice: % conseils rattachés (0 = rejeu) ; orphelins restants : 0', v_updated;
END
$repair$;
