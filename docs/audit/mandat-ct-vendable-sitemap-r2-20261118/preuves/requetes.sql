-- Requêtes du mandat CT (lecture seule, 2026-11-18). Heures UTC dans README.md.

-- 1. Couples gamme × type selon la nouvelle règle : une transaction par gamme,
--    par fenêtres de types (ici la gamme 8, première fenêtre ; même texte pour les 123 gammes).
copy (select 8, t.type_id_i from auto_type t where t.type_display='1' and t.type_id_i between 1 and 6317
 and exists (select 1 from pieces_relation_type r join pieces_price pp on pp.pri_piece_id_i=r.rtp_piece_id join pieces pc on pc.piece_id=r.rtp_piece_id
  where r.rtp_pg_id=8 and r.rtp_type_id=t.type_id_i and pp.pri_dispo in ('1','2','3') and pp.pricing_state<>'FROZEN' and pp.pri_vente_ttc_n>0 and pc.piece_display) order by 2) to stdout;

-- 2. Véhicules affichés et gammes indexables
\echo UTC
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"');
\copy (select t.type_id_i, t.type_alias, t.type_modele_id_i, t.type_marque_id_i, m.modele_alias, m.modele_display, m.modele_marque_id, b.marque_alias, b.marque_display, t.type_relfollow, b2.marque_alias as type_marque_alias, t.type_modele_id from auto_type t left join auto_modele m on m.modele_id = t.type_modele_id_i left join auto_marque b on b.marque_id = m.modele_marque_id left join auto_marque b2 on b2.marque_id = t.type_marque_id_i where t.type_display='1' order by 1) to 'mes/vehicules.tsv'
\copy (select pg_id, pg_alias from pieces_gamme where pg_display='1' and pg_relfollow='1' order by 1) to 'mes/gammes.tsv'

-- 3. Search Console, 28 jours
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') utc, min(date), max(date), count(*) from __seo_gsc_daily_page_totals where date >= '2026-10-01';
\copy (select page, sum(clicks) c28, sum(impressions) i28 from __seo_gsc_daily_page_totals where date between '2026-10-19' and '2026-11-15' and page like '%/pieces/%' group by page) to 'mes/gsc_pieces.tsv'

-- 4. Plan générique de la fonction
\echo UTC
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"');
prepare q(integer, integer, integer) as
  SELECT coalesce(array_agg(t.type_id_i ORDER BY t.type_id_i), '{}'::integer[])
    FROM public.auto_type t
   WHERE t.type_display = '1'
     AND t.type_id_i BETWEEN $2 AND $3
     AND EXISTS (
           SELECT 1
             FROM public.pieces_relation_type r
             JOIN public.pieces pc ON pc.piece_id = r.rtp_piece_id
             JOIN public.pieces_price pp ON pp.pri_piece_id_i = r.rtp_piece_id
            WHERE r.rtp_pg_id = $1
              AND r.rtp_type_id = t.type_id_i
              AND (pp.pri_dispo IS NOT NULL AND pp.pri_dispo IN ('1','2','3'))
              AND pp.pricing_state IS DISTINCT FROM 'FROZEN'
              AND pc.piece_display IS TRUE
              AND (pp.pri_vente_ttc_n IS NOT NULL AND pp.pri_vente_ttc_n > 0 AND pp.pri_vente_ttc_n < 'Infinity'::numeric));
set plan_cache_mode = force_generic_plan;
\echo == plan generique, gamme 4, fenetre 57403-60669 (celle qui depassait 40 s en plan sur mesure)
explain (analyze, buffers, costs off, timing off) execute q(4, 57403, 60669);
\echo == plan generique, gamme 4, tous les types
explain (analyze, costs off, timing off, summary on) execute q(4, 1, 200000);

-- 5. Prix non finis
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') as utc;
select data_type, numeric_precision, numeric_scale from information_schema.columns where table_schema='public' and table_name='pieces_price' and column_name='pri_vente_ttc_n';
select count(*) as prix_non_finis from pieces_price where pri_vente_ttc_n in ('NaN','Infinity','-Infinity');

-- 6. Échantillon de 50 URL : pièces vendables par couple
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') as utc;
select v.pg, v.ty,
  (select count(distinct r.rtp_piece_id) from pieces_relation_type r join pieces_price pp on pp.pri_piece_id_i=r.rtp_piece_id join pieces pc on pc.piece_id=r.rtp_piece_id
   where r.rtp_pg_id=v.pg and r.rtp_type_id=v.ty and pp.pri_dispo in ('1','2','3') and pp.pricing_state is distinct from 'FROZEN' and pp.pri_vente_ttc_n>0 and pp.pri_vente_ttc_n not in ('NaN','Infinity') and pc.piece_display is true) as pieces_vendables
from (values (2,67295),(7,19490),(8,62018),(10,14764),(13,11343),(40,69010),(70,31364),(82,15128),(83,32069),(124,77660),(188,24534),(193,21317),(243,66742),(258,57306),(274,5285),(285,33063),(298,27950),(307,18727),(312,22503),(318,11038),(321,53263),(402,17793),(412,14772),(424,60826),(447,28385),(455,10917),(467,19214),(469,61687),(471,57271),(479,82382),(577,23202),(593,83138),(653,9044),(685,2130),(805,15821),(807,5604),(830,12168),(851,73641),(1108,20768),(1216,7892),(1260,76391),(1389,70878),(1561,33312),(1750,32798),(2234,31217),(2669,32270),(3874,5854),(3894,59030),(3922,5277),(3939,18731)) as v(pg,ty) order by 1,2;

-- 7. Pages Search Console de gammes hors règle d'indexabilité : vendables ou non
--    (1 765 couples en VALUES, abrégés ici ; liste = pages GSC ni au sitemap actuel ni dans le nouveau lot, gamme hors des 123)
select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') as utc;
with v(pg,ty,pages,clics) as (values (289,67171,1,0), … ),
j as (select v.*, exists (select 1 from pieces_relation_type r join pieces_price pp on pp.pri_piece_id_i=r.rtp_piece_id join pieces pc on pc.piece_id=r.rtp_piece_id
   where r.rtp_pg_id=v.pg and r.rtp_type_id=v.ty and pp.pri_dispo in ('1','2','3') and pp.pricing_state is distinct from 'FROZEN' and pp.pri_vente_ttc_n>0 and pc.piece_display is true) as vendable,
   exists (select 1 from auto_type t where t.type_id_i=v.ty and t.type_display='1') as type_affiche from v)
select vendable, type_affiche, count(*) couples, sum(pages) pages, sum((clics>0)::int) couples_cliques, sum(clics) clics from j group by 1,2 order by 1,2;
select g.pg_display, g.pg_relfollow, count(distinct v.pg) gammes, count(*) couples from (values (289,67171,1,0), … ) v(pg,ty,pages,clics) left join pieces_gamme g on g.pg_id=v.pg group by 1,2 order by 1,2;
