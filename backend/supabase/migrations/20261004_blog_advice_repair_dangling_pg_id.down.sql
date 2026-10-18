-- Rollback: 20261004_blog_advice_repair_dangling_pg_id
-- Remet l'ancien ba_pg_id sur les 12 conseils rattachés par la migration, et
-- sur eux seuls : une ligne n'est remise que si son ba_pg_id est encore
-- exactement le nouvel identifiant (une valeur modifiée depuis par un autre
-- canal est conservée et signalée). Aucune autre colonne n'est touchée.
-- Effet : /blog-pieces-auto/conseils/{gamme} redevient 404 pour ces gammes et
-- l'article revient sur /blog-pieces-auto/article/{ba_alias}.
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et constat
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unrepair$
DECLARE
  c_rows CONSTANT jsonb := $json$
    [{"ba_id":"3","old":"1583","new":2234}
    ,{"ba_id":"10","old":"1804","new":3927}
    ,{"ba_id":"25","old":"1803","new":3922}
    ,{"ba_id":"29","old":"1576","new":2066}
    ,{"ba_id":"35","old":"1783","new":3902}
    ,{"ba_id":"50","old":"1683","new":3859}
    ,{"ba_id":"65","old":"1623","new":3213}
    ,{"ba_id":"67","old":"1557","new":1750}
    ,{"ba_id":"71","old":"1592","new":2462}
    ,{"ba_id":"80","old":"1695","new":3874}
    ,{"ba_id":"87","old":"1612","new":2669}
    ,{"ba_id":"101","old":"1536","new":1561}
    ]
  $json$::jsonb;
  v_reset bigint;
  v_kept  bigint;
BEGIN
  IF jsonb_array_length(c_rows) <> 12 THEN
    RAISE EXCEPTION 'ABORT: liste — 12 lignes attendues, % trouvées', jsonb_array_length(c_rows);
  END IF;

  -- Nom non qualifié (search_path épinglé ci-dessus) : forme reconnue par le
  -- ratchet des écritures de contenu servi.
  UPDATE __blog_advice ba
     SET ba_pg_id = e.old
    FROM jsonb_to_recordset(c_rows) AS e(ba_id text, old text, new integer)
   WHERE ba.ba_id = e.ba_id
     AND ba.ba_pg_id = e.new::text;
  GET DIAGNOSTICS v_reset = ROW_COUNT;

  -- Lignes ni sur l'ancien ni sur le nouvel identifiant : modifiées par un autre canal.
  SELECT count(*) INTO v_kept
    FROM jsonb_to_recordset(c_rows) AS e(ba_id text, old text, new integer)
    JOIN public.__blog_advice ba ON ba.ba_id = e.ba_id
   WHERE ba.ba_pg_id IS DISTINCT FROM e.old;
  RAISE NOTICE '__blog_advice: % conseils remis sur leur ancien identifiant ; % conservés (modifiés depuis la migration)',
    v_reset, v_kept;
END
$unrepair$;

COMMIT;
